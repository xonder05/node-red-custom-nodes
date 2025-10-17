/**
 * @file ros-launch.js
 * @author Daniel Onderka (xonder05)
 * @date 10/2025
 */

module.exports = function(RED) 
{
    const is_web_api = require("is-web-api");
    const fs = require('fs');

    function ROSLaunch(config) 
    {
        RED.nodes.createNode(this, config);
        const node = this;

        function init()
        {
            // slice only the node id without subflows
            node.node_id = node.id.slice(node.id.lastIndexOf("-") + 1)
            node.log = "";

            // get corresponding manager config from enviroment
            node.manager_config = RED.nodes.getNode(config.manager);

            node.state = {fill: "grey", shape: "dot", text: "Offline"};
            node.status(node.state);

            register_is();

            RED.events.once("flows:started", flow_started_event_handler.bind(this))
            node.on("close", close_event_handler.bind(this));
        }

        function flow_started_event_handler()
        {
            is_web_api.launch();

            const msg = {
                manager_id: node.manager_config.manager_id,
                message_type: 20,
                node_id: "id_" + node.node_id,
                package_name: config.package, 
                node_name: config.launch_name, 
                param_json: JSON.stringify(config.launch_args),
                remap_json: "{}",
                return_value: 0
            };
            
            if (!is_web_api.send_message("management/commands", msg))
            {
                node.state = {fill: "yellow", shape: "dot", text: "Calling launch file"}
                node.status(node.state);

                setTimeout(() => {
                    if (node.state.fill == "yellow")
                    {
                        node.state = {fill: "red", shape: "dot", text: "Backend didn't respond"}
                        node.status(node.state);
                    }
                }, 5000);
            }
            else
            {
                node.state = {fill: "blue", shape: "dot", text: "Waiting for Integration Service"}
                node.status(node.state);

                setTimeout(() => {
                    flow_started_event_handler();
                }, 1000);
            }
        }

        function close_event_handler(removed, done)
        {
            // first handler call (from node-red)
            if (removed && done)
            {
                node.removed = removed;
                node.done = done;
            }

            // last handler call, proper cleanup
            if (["grey", "blue", "red"].includes(node.state.fill))
            {
                clearTimeout(node.close_timeout);
                unregister_is();
                is_web_api.launch();
                node.done();
                return;
            }
            
            // ros2 communication
            const msg = {
                manager_id: node.manager_config.manager_id,
                message_type: 50,
                node_id: "id_" + node.node_id,
                package_name: config.package, 
                node_name: config.launch_name, 
                param_json: "{}",
                remap_json: "{}",
                return_value: 0
            };

            if (!is_web_api.send_message("management/commands", msg))
            {
                node.state = {fill: "yellow", shape: "dot", text: "Stopping launch file"}
                node.status(node.state);

                node.closing = true;

                node.close_timeout = setTimeout(() => {
                    if (node.state.fill != "grey")
                    {
                        node.state = {fill: "red", shape: "dot", text: "Backend didn't respond"}
                        node.status(node.state);
                        close_event_handler();
                    }
                }, 10000);
            }
            else
            {
                node.state = {fill: "yellow", shape: "dot", text: "Waiting for Integration Service"}
                node.status(node.state);

                setTimeout(() => {
                    close_event_handler();
                }, 100);
            }
        }

        function register_is()
        {
            // join commands topic
            const interface_path = get_interface_path("node_manager", "NodeRedCommand");
            const folder_path = interface_path.slice(0, interface_path.lastIndexOf("/"));
            is_web_api.add_custom_ros2_type("node_manager", "NodeRedCommand", folder_path);

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

            // join topic with node's stdout
            is_web_api.add_ros2_type("std_msgs", "String");
            is_web_api.add_subscriber(`management/stdout/id_${node.node_id}`, "std_msgs/String", []);

            const event_emitter = is_web_api.get_event_emitter();

            event_emitter.on("management/commands", commands_callback);
            event_emitter.on(`management/stdout/id_${node.node_id}`, log_callback);
        }

        function unregister_is()
        {
            // join commands topic
            const interface_path = get_interface_path("node_manager", "NodeRedCommand");
            const folder_path = interface_path.slice(0, interface_path.lastIndexOf("/"));
            is_web_api.remove_custom_ros2_type("node_manager", "NodeRedCommand", folder_path);

            const topic_name = "management/commands";
            is_web_api.remove_publisher(topic_name);
            is_web_api.remove_subscriber(topic_name);

            // join topic with node's stdout
            is_web_api.remove_ros2_type("std_msgs", "String");

            // subsribe
            is_web_api.remove_subscriber(`management/stdout/id_${node.node_id}`);

            event_emitter = is_web_api.get_event_emitter();

            event_emitter.off("management/commands", commands_callback);
            event_emitter.off(`management/stdout/id_${node.node_id}`, log_callback);
        }

        function commands_callback(msg)
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
            if([1, 11].includes(res.return_value))
            {
                node.state = {fill: "green", shape: "dot", text: "Running"} 
                node.status(node.state);
            }
            else
            {
                node.state = {fill: "red", shape: "dot", text: ("Error: " + res.return_value)}
                node.status(node.state);
            }

            if(!node.closing) {
                return;
            }

            // set node status based on the return value
            if([5, 15].includes(res.return_value))
            {
                node.state = {fill: "grey", shape: "dot", text: "Offline"} 
                node.status(node.state);

                close_event_handler();
            }
            else
            {
                // error stopping, todo handle gracefully
            }
        }

        function log_callback(msg)
        {
            node.log = node.log + msg.msg?.data + "\n";

            RED.comms.publish("log", {
                id: node.id,
                log: node.log,
            }, true);
        }

        init();
    };

    RED.nodes.registerType("ros-launch", ROSLaunch);

//-------------------- Instance independent Endpoints and Helpers --------------------

    RED.httpAdmin.get("/ros-launch/list_packages", RED.auth.needsPermission("ros-launch.read"), function (req, res) 
    {
        const { exec } = require("child_process");
        const cmd = `python3 -c "import json; from ament_index_python.packages import get_packages_with_prefixes; print(json.dumps(sorted(list(get_packages_with_prefixes().keys()))))"`;

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

    RED.httpAdmin.get("/ros-launch/list-launch", RED.auth.needsPermission("ros-launch.read"), function (req, res) 
    {
        const selectedPackage = req.query.package;

        const { exec } = require("child_process");
        const cmd = `python3 -c "import argparse, json; from ros2launch.api.api import LaunchFileNameCompleter; print(json.dumps(LaunchFileNameCompleter()(None, argparse.Namespace(package_name='${selectedPackage}'))))"`;

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

    RED.httpAdmin.get("/ros-launch/get-arguments", RED.auth.needsPermission("ros-launch.read"), function (req, res) 
    {
        const launch_file_path = req.query.launch_file_path;

        const { exec } = require("child_process");
        const cmd = `python3 -c "import json; from launch.launch_description_sources import get_launch_description_from_any_launch_file; print(json.dumps( { a.name: ' + '.join([token.describe().strip('\\'\\"') for token in a.default_value]) for a in get_launch_description_from_any_launch_file('${launch_file_path}').get_launch_arguments() } ) )"`;

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

    RED.httpAdmin.get("/ros-launch/get-full-launch-path", RED.auth.needsPermission("ros-launch.read"), function (req, res) 
    {
        const package_name = req.query.package_name;
        const launch_file_name = req.query.launch_file_name;

        const { exec } = require("child_process");
        const cmd = `python3 -c "from ros2launch.api.api import get_share_file_path_from_package; print(get_share_file_path_from_package(package_name='${package_name}', file_name='${launch_file_name}'))"`;

        exec(cmd, (error, stdout, stderr) => 
        {
            if (error) {
                console.error(`Exec error: ${error.message}`);
                return res.status(500).json({ error: "Python execution failed" });
            }
            try {
                res.json(stdout.trim());
            }
            catch (err) {
                console.error("JSON parse error:", err);
                res.status(500).json({ error: "Invalid JSON output" });
            }
        });
    });

    RED.httpAdmin.get("/ros-launch/get-file-content", RED.auth.needsPermission("ros-launch.read"), function (req, res) 
    {
        const file_path = req.query.file_path;

        fs.readFile(file_path, "utf8", (err, data) => 
        {
            if (err) {
                console.error(err);
                return;
            }
            
            const file_content = JSON.stringify(data);
            res.json(file_content);
        });
    });

    if(!global.log_setup_complete)
    {
        global.log_setup_complete = true;

        RED.httpAdmin.get("/get-log", RED.auth.needsPermission("ros-launch.read"), function (req, res) 
        {
            const node = RED.nodes.getNode(req.query.id);

            if (node) {
                res.send(node.log);
            }
            else {
                res.status(404).json({ error: "Node not found" });
            }
        });
    }

    function get_interface_path(package, interface)
    {
        const { execSync } = require("child_process");

        const package_name = package + "/msg/" + interface;
        const cmd = `python3 -c "from rosidl_runtime_py import get_interface_path; print(get_interface_path('${package_name}'))"`;

        const stdout = execSync(cmd, {encoding: "utf8"}); 
        return stdout;
    };
}