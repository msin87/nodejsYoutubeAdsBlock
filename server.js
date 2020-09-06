//inspired by https://github.com/kolobok86/dns-proxy/releases/tag/v0.0.2
const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const functions = require('./functions.js');
const settings = require('./settings.json');
let blackList=[];
const sendAllowMsg = async (localReq, dnsRequest, linfo) => {
    const upstreamResponse = await functions.getRemoteDnsResponseBin(localReq, settings.upstreamDNSServer.address, 53);
    server.send(upstreamResponse, linfo.port, linfo.address);
}
const sendDenyMsg = (dnsRequest, linfo) => {
    const question = dnsRequest.questions[0];
    const localDnsResponse = {
        ID: dnsRequest.ID,
        QR: true,
        Opcode: 0,
        AA: 1,
        TC: 0,      // dnsRequest.TC,
        RD: 1,
        RA: 1,       // ToDo should it be some more complex logic here, rather then simply setting to 'true'?
        Z: 0,
        RCODE: 0,       // dnsRequest.RCODE,    0 - no errors, look in RFC-1035 for other error conditions
        QDCOUNT: dnsRequest.QDCOUNT,
        ANCOUNT: 1,
        NSCOUNT: 0,
        ARCOUNT: 0,     // we don't create records in Additional section
        questions: dnsRequest.questions,
        answers: [{
            domainName: question.domainName,
            type: 1,
            class: 1,
            ttl: 2,
            rdlength: 4,
            rdata_bin: functions.ip4StringToBuffer('0.0.0.0'),
            IPv4: '0.0.0.0'
        }]
    }
    const responseBuf = functions.composeDnsMessageBin(localDnsResponse);
    server.send(responseBuf, linfo.port, linfo.address);
}
const msgCb = async (localReq, linfo) => {
    const dnsRequest = functions.parseDnsMessageBytes(localReq);
    const question = dnsRequest.questions[0];
    if (settings.staticBlackList.filter(record=>record===question.domainName).length){
        console.log('Deny static: ' + question.domainName)
        sendDenyMsg(dnsRequest, linfo);
        return;
    }
    if (question.domainName.indexOf('googlevideo.com') >= 0) {
        const blackListItem = blackList.filter(record => record.name === question.domainName)
        if (blackListItem.length) {
            if (Date.now() - blackListItem.time <= settings.allowTimeMs){
                console.log('Deny: ' + question.domainName + " record in blacklist");
                sendDenyMsg(dnsRequest, linfo);
            }
            else {
                await sendAllowMsg(localReq,dnsRequest, linfo);
                console.log('Allow: ' + question.domainName + " deleting record from blacklist");
                blackList = blackList.filter(record => record.name !== question.domainName);
            }
        } else {
            blackList.push({name: question.domainName, time: Date.now()});
            console.log('Deny: ' + question.domainName + " adding record to blacklist");
            sendDenyMsg(dnsRequest, linfo);
        }

    } else {
        await sendAllowMsg(localReq,dnsRequest, linfo);
    }
}
server.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
});
server.on('message', msgCb);
server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
});
server.bind(53);

