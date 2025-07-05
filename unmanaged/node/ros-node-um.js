module.exports = function(RED) 
{
    function RosNodeUm(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        // slice only the node id without subflows
        node.node_id = node.id.slice(node.id.lastIndexOf("-") + 1)

    }

    RED.nodes.registerType("ros-node-um", RosNodeUm);

}