module.exports = function(RED) {
    
    var WebSocket = require('ws');
    var is_web_api = require('is-web-api').ros2;

    function RosNode(config) {
        RED.nodes.createNode(this,config);
        const node = this;


        // 1. Set DDS domain (optional)
        is_web_api.set_dds_domain(0);  // if needed

        // is_web_api.add_ros2_type("interfaces", "msg/NodeRedCommand");
        is_web_api.add_custom_ros2_type("interfaces", "NodeRedCommand", "/home/daniel/ros2_ws/install/interfaces/share/interfaces/msg");

        // 2. Add publisher client
        const publisher_id = "publisher";
        const topic_name = 'management/commands';
        const message_type = 'interfaces/NodeRedCommand';

        let result = is_web_api.add_publisher(publisher_id, topic_name, message_type, []);
        if (result.color === "red") {
            console.error("Error:", result.message);
            process.exit(1);
        }

        // 3. Launch IS for this client
        is_web_api.launch(config['id']);

        // 4. Wait briefly, then send request
        setTimeout(() => {
            const msg = {
                manager_id: 1, 
                message_type: 0, 
                package_name: 'demo_nodes_cpp', 
                node_name: 'talker', 
                data: 'whatever'
            };

            is_web_api.send_message(topic_name, msg);
            console.log("Published message:", msg);
        }, 5000);


        // node.on('input', function(msg) {
        //     console.log("message received");
        //     node.status({ fill: "green", shape: "dot", text: "Deployed & Sent!" });

        //     const ws = new WebSocket("ws://localhost:8080");
        //     ws.onopen = () => {
        //         console.log('Connected!');
        //     };

        //     setTimeout(() => {
        //         console.log("This runs after 2 seconds");
        //         ws.send('Hello, WebSocket!');
        //     }, 2000);

        // });

        // node.on('close', function(done) {
        //     node.status({ fill: "grey", shape: "dot", text: "fu" });
        //     node.log("MyStartupSenderNode is closing down.");
        //     done(); // Call done() when cleanup is complete
        // });

    }
    RED.nodes.registerType("ros-node", RosNode);

    RED.httpAdmin.get("/ros-node/options", RED.auth.needsPermission("ros-node.read"), function (req, res) {

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

    RED.httpAdmin.get("/ros-node/nodes", RED.auth.needsPermission("ros-node.read"), function (req, res) {

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


}