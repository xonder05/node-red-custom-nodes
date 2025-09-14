module.exports = function(RED) 
{
    var is_web_api = require("is-web-api").ros2;
    
    function RosNode(config) {
        RED.nodes.createNode(this,config);
        const node = this;

        // slice only the node id without subflows
        node.node_id = node.id.slice(node.id.lastIndexOf('-') + 1)

        node.status({ fill: "black", shape: "dot", text: "Offline" });

        // get corresponding manager config from enviroment
        this.manager_config = RED.nodes.getNode(config.manager);

        RED.events.on("is-restart", register_is);

        node.log = "";

        function register_is()
        {
            // join commands topic
            const interface_path = get_interface_path("node_manager", "NodeRedCommand");
            const folder_path = interface_path.slice(0, interface_path.lastIndexOf("/"));
            is_web_api.add_custom_ros2_type("node_manager", "NodeRedCommand", folder_path);

            const topic_name = "management/commands";
            const message_type = "node_manager/NodeRedCommand";
            is_web_api.add_publisher(node.id, topic_name, message_type, []);
            is_web_api.add_subscriber(node.id, topic_name, message_type, []);

            // join topic with node's stdout
            is_web_api.add_ros2_type("std_msgs", "String", []);

            // subsribe
            is_web_api.add_subscriber(config.id, "management/stdout/id_" + node.node_id, "std_msgs/String", []);

            node.event_emitter = is_web_api.get_event_emitter();

            if (node.event_emitter) 
            {
                node.event_emitter.on("management/stdout/id_" + node.node_id + "_data", (msg_json) =>
                {
                    node.log = node.log + msg_json.msg?.data + "\n";

                    RED.comms.publish("log", {
                        id: node.id,
                        log: node.log,
                    }, true);
                });

                node.event_emitter.on("management/commands_data", (msg) => 
                {
                    const res = msg.msg;
                    const id = res.node_id.slice(3); // remove "id_" from the start
                    
                    // message for someone else
                    if(id != node.node_id) 
                    {
                        console.log("Recieved command message for someone else, ignoring");
                        return;
                    }

                    // only interested in response messages
                    if(res.message_type != 90) 
                    {
                        console.log("Recievent message that is not response, ignoring");
                        return;
                    }

                    // set node status based on the return value
                    if([1, 2, 3].includes(res.return_value))
                    {
                        node.status({ fill: "green", shape: "dot", text: "Running" });
                    }
                    else
                    {
                        node.status({ fill: "red", shape: "dot", text: ("Error: " + node.return_value) });
                    }

                });
            }

        }

        RED.events.once("flows:started", () =>
        {
            is_web_api.new_config();
            is_web_api.stop();

            RED.events.emit("is-restart", { msg: "" });

            is_web_api.launch(config["id"]);
            
            setTimeout(() => 
            {
                const param_json = '[' + 
                                    config.param.split('\n')
                                                .map(line => '\"' + line + '\"')
                                                .join(',') 
                                   + ']';


                const remap_json = '[' + 
                                    config.remap.split('\n')
                                                .map(line => '\"' + line + '\"')
                                                .join(',')
                                   + ']';

                const msg = {
                    manager_id: node.manager_config.manager_id,
                    message_type: 10, 
                    node_id: "id_" + node.node_id,
                    package_name: config.package, 
                    node_name: config.node, 
                    param_json: param_json,
                    remap_json: remap_json,
                    return_value: 0
                };

                is_web_api.send_message("management/commands", msg);
                
                node.status({ fill: "yellow", shape: "dot", text: "Requesting node start" });
            
            }, 5000);
        })

        node.on("close", function(done) 
        {
            const msg = {
                manager_id: node.manager_config.manager_id,
                message_type: 50,
                node_id: "id_" + node.node_id,
                package_name: config.package, 
                node_name: config.node, 
                param_json: "{}",
                remap_json: "{}",
                return_value: 0
            };
            is_web_api.send_message("management/commands", msg);

            node.event_emitter = is_web_api.get_event_emitter();

            node.event_emitter.on("management/commands_data", (msg) => 
            {
                const res = msg.msg;
                const id = res.node_id.slice(3); // remove "id_" from the start
                
                // message for someone else
                if(id != node.node_id) 
                {
                    console.log("Recieved command message for someone else, ignoring");
                    return;
                }

                // only interested in response messages
                if(res.message_type != 90) 
                {
                    console.log("Recievent message that is not response, ignoring");
                    return;
                }

                // set node status based on the return value
                if([5].includes(res.return_value))
                {
                    RED.events.off("is-restart", register_is);

                    is_web_api.new_config();
                    is_web_api.stop();
                    
                    RED.events.emit("is-restart", { msg: "" });

                    is_web_api.launch(config[id]);

                    node.status({ fill: "grey", shape: "dot", text: "Off" });
                    done();
                }
                else
                {
                    // error stopping, todo handle gracefully
                }
            });
        });
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

    RED.httpAdmin.get("/global-js/*", function(req, res)
    {
        var options = {
            root: __dirname + "/../global/",
            dotfiles: 'deny'
        };

        res.sendFile(req.params[0], options);
    });

}