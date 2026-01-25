/**
 * @file ros-publisher.js
 * @author Daniel Onderka
 * @date 01/2026
 */

module.exports = function(RED) 
{
    var is_web_api = require("is-web-api");

    function ROSPublisher(config) {
        RED.nodes.createNode(this,config);
        const node = this;

        function init()
        {
            // slice only the node id without subflows
            node.node_id = node.id.slice(node.id.lastIndexOf("-") + 1)

            node.state = {fill: "grey", shape: "dot", text: "Offline"};
            node.status(node.state);

            register_is();

            RED.events.once("flows:started", flow_started_event_handler.bind(this))
            node.on("input", input_event_handler);
            node.on("close", close_event_handler.bind(this));
        }

        function flow_started_event_handler()
        {
            is_web_api.launch();
        }

        function close_event_handler(removed, done)
        {
            unregister_is();

            is_web_api.launch();

            node.state = {fill: "yellow", shape: "dot", text: "Waiting for Integration Service"}
            node.status(node.state);

            done();
        }

        function input_event_handler(msg, send, done)
        {
            is_web_api.send_message(config.topic, msg);
            done();
        }

        function register_is()
        {
            // join commands topic
            const interface_path1 = get_interface_path("node_manager", "NodeRedCommand");
            const folder_path1 = interface_path1.slice(0, interface_path1.lastIndexOf("/"));
            is_web_api.add_custom_ros2_type("node_manager", "NodeRedCommand", folder_path1);

            const topic_name = "management/commands";
            const message_type = "node_manager/NodeRedCommand";
            const qos = {
                history: {
                    kind: "KEEP_LAST",
                    depth: 10
                },
                reliability: "RELIABLE",
                durability: "VOLATILE"
            };

            is_web_api.add_publisher(topic_name, message_type, qos);
            is_web_api.add_subscriber(topic_name, message_type, qos);


            // add type
            const interface_name = config.interface.slice(config.interface.lastIndexOf("/") + 1);
            const interface_path = get_interface_path(config.package, interface_name);
            const folder_path = interface_path.slice(0, interface_path.lastIndexOf("/"));
            // is_web_api.add_custom_ros2_type(config.package, interface_name, folder_path);
            

            is_web_api.add_ros2_type(config.package, interface_name);

            // advertise
            is_web_api.add_publisher(config.topic, config.package + "/" + interface_name, []);
            node.log = "";
        }

        function unregister_is()
        {
            // add type
            const interface_name = config.interface.slice(config.interface.lastIndexOf("/") + 1);
            const interface_path = get_interface_path(config.package, interface_name);
            const folder_path = interface_path.slice(0, interface_path.lastIndexOf("/"));
            // is_web_api.remove_custom_ros2_type(config.package, interface_name, folder_path);
            is_web_api.remove_ros2_type(config.package, interface_name);

            // unadvertise
            is_web_api.remove_publisher(config.topic);
        }

        init();
    }

    RED.nodes.registerType("ros-publisher", ROSPublisher);

//-------------------- Instance independent Endpoints and Helpers --------------------

    RED.httpAdmin.get("/ros-publisher/list-packages", RED.auth.needsPermission("ros-publisher.read"), function (req, res) 
    {
        const { exec } = require("child_process");
        const cmd = `python3 -c "import json; from ament_index_python.packages import get_packages_with_prefixes; print(json.dumps(list(get_packages_with_prefixes().keys())))"`;

        exec(cmd, (error, stdout, stderr) => 
        {
            if (error) {
                console.error(`Exec error: ${error.message}`);
                return res.status(500).json({ error: "Python execution failed" });
            }

            try {
                const packages = JSON.parse(stdout);
                res.json(packages);
            }
            catch (err) {
                console.error("JSON parse error:", err);
                res.status(500).json({ error: "Invalid JSON output" });
            }
        });
    });

    RED.httpAdmin.get("/ros-publisher/list-interfaces", RED.auth.needsPermission("ros-publisher.read"), function (req, res) 
    {
        const selectedPackage = req.query.package;

        const { exec } = require("child_process");
        const cmd = `python3 -c "import json; from rosidl_runtime_py import get_message_interfaces; print(json.dumps(get_message_interfaces(['${selectedPackage}'])['${selectedPackage}']))"`;

        exec(cmd, (error, stdout, stderr) => 
        {
            if (error) {
                console.error(`Exec error: ${error.message}`);
                return res.status(500).json({ error: "Python execution failed" });
            }

            try {
                const packages = JSON.parse(stdout);
                res.json(packages);
            } 
            catch (err) {
                console.error("JSON parse error:", err);
                res.status(500).json({ error: "Invalid JSON output" });
            }
        });
    });

    RED.httpAdmin.get("/ros-publisher/get-log", RED.auth.needsPermission("ros-publisher.read"), function (req, res) 
    {
        res.send(node.log);
    });

    function get_interface_path(package, interface)
    {
        const { execSync } = require("child_process");

        const package_name = package + "/msg/" + interface;
        const cmd = `python3 -c "from rosidl_runtime_py import get_interface_path; print(get_interface_path('${package_name}'))"`;

        const stdout = execSync(cmd, {encoding: "utf8"}); 
        return stdout;
    }
}