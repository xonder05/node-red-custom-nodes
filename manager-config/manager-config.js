module.exports = function(RED) 
{
    function ManagerConfig(config) {
        RED.nodes.createNode(this, config);

        this.dds_domain = config.dds_domain;
        this.manager_id = config.manager_id;
    }

    RED.nodes.registerType("manager-config", ManagerConfig);
}