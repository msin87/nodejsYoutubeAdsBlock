const dgram = require('dgram');
const udpServer = dgram.createSocket('udp4');

udpServer.on('listening', ()=>console.log('UDP server listening on 443 port'))
udpServer.on("error", (err)=>console.log(err));
udpServer.on("message", (localReq, linfo)=>{
    console.log(localReq, linfo);
})
udpServer.bind(443);
