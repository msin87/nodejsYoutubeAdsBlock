//inspired by https://github.com/kolobok86/dns-proxy/releases/tag/v0.0.2
const dgram = require('dgram');
const dnsServer = dgram.createSocket('udp4');
const functions = require('./functions.js');
const settings = require('./settings.json');

let blackList=[];
const sendAllowMsg = async (localReq, dnsRequest, linfo) => {
    const upstreamResponse = await functions.getRemoteDnsResponseBin(localReq, settings.upstreamDNSServer.address, 53);
    dnsServer.send(upstreamResponse, linfo.port, linfo.address);
}

const sendDenyMsg = (dnsRequest, linfo, staticBlackList=false) => {
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
            ttl: 0,
            rdlength: 4,
            rdata_bin: functions.ip4StringToBuffer(staticBlackList?'0.0.0.0':'192.168.1.67'),
            IPv4: staticBlackList?'0.0.0.0':'192.168.1.67'
        }]
    }
    const responseBuf = functions.composeDnsMessageBin(localDnsResponse);
    dnsServer.send(responseBuf, linfo.port, linfo.address);
}
const msgCb = async (localReq, linfo) => {
    const dnsRequest = functions.parseDnsMessageBytes(localReq);
    const question = dnsRequest.questions[0];
    if (settings.staticBlackList.filter(record=>record===question.domainName).length){
        console.log('Deny static: ' + question.domainName)
        sendDenyMsg(dnsRequest, linfo, true);
        return;
    }
    if (question.domainName.indexOf('googlevideo.com') >= 0) {
        const blackListItem = blackList.filter(record => record.name === question.domainName)
        if (blackListItem.length) {
            if (Date.now() - blackListItem.time <= settings.allowTimeMs){
                console.log('Deny: ' + question.domainName + " record in blacklist");
                sendDenyMsg(dnsRequest, linfo, false);
            }
            else {
                await sendAllowMsg(localReq,dnsRequest, linfo);
                console.log('Allow: ' + question.domainName + " deleting record from blacklist");
                blackList = blackList.filter(record => record.name !== question.domainName);
            }
        } else {
            blackList.push({name: question.domainName, time: Date.now()});
            console.log('Deny: ' + question.domainName + " adding record to blacklist");
            sendDenyMsg(dnsRequest, linfo, false);
        }

    } else {
        await sendAllowMsg(localReq,dnsRequest, linfo);
        console.log('Allow: ' + question.domainName);
    }
}
dnsServer.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    dnsServer.close();
});
dnsServer.on('message', msgCb);
dnsServer.on('listening', () => {
    const address = dnsServer.address();
    console.log(`DNS server listening ${address.address}:${address.port}`);
});
dnsServer.bind(53);
module.exports = {dnsServer};
