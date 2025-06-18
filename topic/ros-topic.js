module.exports = function(RED) {

    // var is_web_api = require('is-web-api').ros2;

    function RosTopic(config) {
        RED.nodes.createNode(this,config);
        const node = this;
        node.on('input', function(msg) {
            msg.payload = msg.payload.toLowerCase();
            node.send(msg);
        });

        RED.events.once("flows:started", function() {
            
            const msg = {
                _msgid: RED.util.generateId(),
                payload: "Hello from MyStartupSenderNode! Flow deployed at " + new Date().toLocaleString(),
                topic: "node_startup_event",
            };
            node.send(msg);
            console.log("message has been sent");
            node.status({ fill: "green", shape: "dot", text: "Deployed & Sent!" });

        });


        // console.log("here");

        // // 1. Set DDS domain (optional)
        // is_web_api.set_dds_domain(0);  // if needed

        // is_web_api.add_ros2_type("interfaces", "msg/NodeRedCommand");

        // // 2. Add publisher client
        // const publisher_id = 'publisher1';
        // const topic_name = '/topic';
        // const message_type = 'interfaces/msg/NodeRedCommand';

        // let result = is_web_api.add_publisher(publisher_id, topic_name, message_type, []);
        // if (result.color === "red") {
        //     console.error("Error:", result.message);
        //     process.exit(1);
        // }

        // // 3. Launch IS for this client
        // is_web_api.launch(config['id']);

        // // 4. Wait briefly, then send request
        // setTimeout(() => {
        //     const msg = {
        //         manager_id: 1,
        //         message_type: 42,
        //         data: 'hello world'
        //     };

        //     is_web_api.send_message(topic_name, msg);
        //     console.log("Published message:", msg);
        // }, 1000);

    }


    RED.nodes.registerType("ros-topic", RosTopic);

    RED.httpAdmin.get("/ros_topic/list_packages", RED.auth.needsPermission("ros-topic.read"), function (req, res) {


        const { exec } = require("child_process");
        const cmd = `python3 -c "import json; from ament_index_python.packages import get_packages_with_prefixes; print(json.dumps(list(get_packages_with_prefixes().keys())))"`;

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

    RED.httpAdmin.get("/ros_topic/list_interfaces", RED.auth.needsPermission("ros-topic.read"), function (req, res) {

        const selectedPackage = req.query.package;

        const { exec } = require("child_process");
        const cmd = `python3 -c "import json; from rosidl_runtime_py import get_message_interfaces; print(json.dumps(get_message_interfaces(['${selectedPackage}'])['${selectedPackage}']))"`;

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