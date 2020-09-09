const dgram = require('dgram');
const udpServer = dgram.createSocket('udp4');

const udpServerFactory = (address = [{
    ip: '192.168.1.50', port: 443, msgCallback: (req, info) => {
    }
}]) => {
    const udpServers = [];
    address.forEach(record => {
        const udpServer = dgram.createSocket('udp4');
        udpServer.on('listening', () => console.log(`UDP server listening ip: ${record.ip}, port: ${record.port}`))
        udpServer.on("error", (err) => console.log(err));
        udpServer.on("message", record.msgCallback)
        udpServers.push(udpServer)
    })
    return udpServers;
}

const udpLogger = (req, info) => {
    console.log('req:' + req);
    console.log('info: ' + info)
}

const udpServers = udpServerFactory([
    {
        ip: '192.168.1.50',
        port: 443,
        msgCallback: udpLogger
    },
    {
        ip: '192.168.1.51',
        port: 443,
        msgCallback: udpLogger
    },
    {
        ip: '192.168.1.52',
        port: 443,
        msgCallback: udpLogger
    },{
        ip: '192.168.1.67',
        port: 443,
        msgCallback: udpLogger
    },
])