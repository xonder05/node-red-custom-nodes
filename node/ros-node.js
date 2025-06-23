module.exports = function(RED) 
{
    var is_web_api = require('is-web-api').ros2;
    var events = require('events');

    function RosNode(config) {
        RED.nodes.createNode(this,config);
        const node = this;

        // join commands topic
        const interface_path = get_interface_path("node_manager", "NodeRedCommand");
        const folder_path = interface_path.slice(0, interface_path.lastIndexOf("/"));
        is_web_api.add_custom_ros2_type("node_manager", "NodeRedCommand", folder_path);

        const topic_name = "management/commands";
        const message_type = "node_manager/NodeRedCommand";
        let result = is_web_api.add_publisher(config.id, topic_name, message_type, []);


        node.on('input', function(m) 
        {
            const msg = {
                manager_id: 1,
                node_id: config.id,
                message_type: 0, 
                package_name: config.package, 
                node_name: config.node, 
                data: "whatever"
            };

            is_web_api.send_message("management/commands", msg);

            node.status({ fill: "green", shape: "dot", text: "Deployed & Sent!" });
        });


        RED.events.once('flows:started', function() 
        {
            let {color, message, event_emitter} = is_web_api.launch(config['id']);
        })

        // node.on('close', function(done) {
        //     node.status({ fill: "grey", shape: "dot", text: "fu" });
        //     node.log("MyStartupSenderNode is closing down.");
        //     done(); // Call done() when cleanup is complete
        // });

    }

    RED.nodes.registerType("ros-node", RosNode);

    RED.httpAdmin.get("/ros-node/list_packages", RED.auth.needsPermission("ros-node.read"), function (req, res) 
    {
        const { exec } = require("child_process");
        const cmd = `python3 -c "import json; from ament_index_python.packages import get_packages_with_prefixes; print(json.dumps(sorted(list(get_packages_with_prefixes().keys()))))"`;

        exec(cmd, 
            (error, stdout, stderr) => {
                if (error) {
                    console.error(`Exec error: ${error.message}`);
                    return res.status(500).json({ error: "Python execution failed" });
                }

                try {
                    const packages = JSON.parse(stdout);
                    res.json(packages);
                } catch (err) {
                    console.error("JSON parse error:", err);
                    res.status(500).json({ error: "Invalid JSON output" });
                }
        });
    });

    RED.httpAdmin.get("/ros-node/list_nodes", RED.auth.needsPermission("ros-node.read"), function (req, res) 
    {
        const selectedPackage = req.query.package;

        const { exec } = require("child_process");
        const cmd = `python3 -c "import json; from ros2pkg.api import get_executable_paths; import os; paths = get_executable_paths(package_name='${selectedPackage}'); print(json.dumps([os.path.basename(p) for p in paths]))"`;

        exec(cmd, 
            (error, stdout, stderr) => {
                if (error) {
                    console.error(`Exec error: ${error.message}`);
                    return res.status(500).json({ error: "Python execution failed" });
                }

                try {
                    const packages = JSON.parse(stdout);
                    res.json(packages);
                } catch (err) {
                    console.error("JSON parse error:", err);
                    res.status(500).json({ error: "Invalid JSON output" });
                }
        });
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