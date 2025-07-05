module.exports = function(RED) 
{
    var is_web_api = require("is-web-api").ros2;
    const axios = require("axios");

    function RosShow(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        // slice only the node id without subflows
        node.node_id = node.id.slice(node.id.lastIndexOf("-") + 1)

        RED.httpAdmin.get("/ros-show/spawn-nodes", RED.auth.needsPermission("ros-show.read"), async function (req, res) 
        {
            // get list of running nodes
            const { execSync } = require("child_process");
            const cmd = `python3 -c "import rclpy, json; from rclpy.node import Node; from ros2node.api import get_node_names; rclpy.init(); n=Node('n'); print(json.dumps([x.name for x in get_node_names(node=n)])); n.destroy_node(); rclpy.shutdown()"`;

            const stdout = execSync(cmd, {encoding: "utf8"}); 
            const nodes = JSON.parse(stdout);

            // ask admin api for current state of flows
            const resin = await axios.get("http://localhost:1880/flows");
            const flows = resin.data;

            // create new nodes
            var x = 300;
            var y = 200;
            const z = node.z;

            for (const node of nodes)
            {
                const new_node = {
                    id: Math.random().toString(16).slice(2),
                    type: "ros-node-um",
                    name: node,
                    x,
                    y,
                    z,
                    wires: []
                };

                flows.push(new_node);

                y += 50  
            }

            // send admin api new version of flows
            await axios.post("http://localhost:1880/flows", flows, {
                headers: { 
                    "Content-Type": "application/json",
                }
            });

            // return success to frontend
            res.status(200).send(`Success ${Math.random().toString(16).slice(2)}`);
        });

        RED.httpAdmin.get("/ros-show/despawn_nodes", RED.auth.needsPermission("ros-topic.read"), async function (req, res) 
        {
            // get flows from admin api
            const flowsRes = await axios.get("http://localhost:1880/flows");
            let flows = flowsRes.data;

            // remove everything umnamanged
            flows = flows.filter(node => {
                return node.type !== "ros-node-um";
            });

            // send back modified flows
            await axios.post("http://localhost:1880/flows", flows, {
                headers: { "Content-Type": "application/json" }
            });

            // return success to frontend
            res.status(200).send(`Success ${Math.random().toString(16).slice(2)}`);        
        });
    }

    RED.nodes.registerType("ros-show", RosShow);
}