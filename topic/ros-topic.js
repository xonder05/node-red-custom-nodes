module.exports = function(RED) 
{
    var is_web_api = require("is-web-api").ros2;

    function RosTopic(config) {
        RED.nodes.createNode(this,config);
        const node = this;

        // slice only the node id without subflows
        node.node_id = node.id.slice(node.id.lastIndexOf("-") + 1)

        // add type
        const interface_name = config.interface.slice(config.interface.lastIndexOf("/") + 1);
        const interface_path = get_interface_path(config.package, interface_name);
        const folder_path = interface_path.slice(0, interface_path.lastIndexOf("/"));
        is_web_api.add_custom_ros2_type(config.package, interface_name, folder_path);

        // subsribe
        is_web_api.add_subscriber(node.node_id, config.topic, config.package + "/" + interface_name, []);
        node.log = "";

        // triggers once every node has completed its construction
        RED.events.once("flows:started", function() 
        {
            let {event_emitter} = is_web_api.launch(config["id"]);

            // ros2 input
            if (event_emitter)
            {
                event_emitter.on(config.topic + "_data", (msg_json) =>
                {
                    node.log = node.log + msg_json.msg?.data + "\n";

                    RED.comms.publish("log", {
                        id: node.id,
                        log: node.log,
                    }, true);
                });
            }

        });

        node.on("close", function(done) 
        {
            is_web_api.stop();
            // node.status({ fill: "grey", shape: "dot", text: "" });
            done();
        });
    }

    RED.nodes.registerType("ros-topic", RosTopic);

    RED.httpAdmin.get("/ros-topic/list-packages", RED.auth.needsPermission("ros-topic.read"), function (req, res) 
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

    RED.httpAdmin.get("/ros-topic/list-interfaces", RED.auth.needsPermission("ros-topic.read"), function (req, res) 
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

    RED.httpAdmin.get("/ros-topic/get-log", RED.auth.needsPermission("ros-topic.read"), function (req, res) 
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

    RED.httpAdmin.get("/global-js/*", function(req, res)
    {
        var options = {
            root: __dirname + "/../global/",
            dotfiles: 'deny'
        };

        res.sendFile(req.params[0], options);
    });
}