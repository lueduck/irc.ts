const encoder = new TextEncoder();
const decoder = new TextDecoder();
import { decodeBase64, encodeBase64 } from "jsr:@std/encoding/base64";


export interface userInfo{
	nick: string;
	user: string;
	password: string;
	ident: string;
}

export class IRC implements userInfo{
    
    nick: string;
	user: string;
    password: string;
	ident: string;
    server: string;
    port: number;
    user: object;
    caps: object;
    socket: object;
    sendCache: object;
    readCache: object;
	callbackCache: object;



	constructor(user: userInfo, server: string, port: number) {
		//const socket = Deno.connect({ hostname: "irc.libera.chat", port: 6667 });
	
		this.server = server;
		this.port = port;
		this.user = user;
		this.caps = ["multi-prefix", "account-notify", "userhost-in-names", "away-notify", "extended-join"];
		this.sendCache = [];
		this.readCache = [];
		this.callbackCache = {};
		
		if(user.password){
			this.caps.push("sasl");
		}
		
		this.reader();
	}

	async reader(){
		const socket = await Deno.connect({ hostname: this.server, port: this.port });
		this.socket = socket;
		await socket.write(encoder.encode("CAP REQ :" + this.caps.join(" ") + "\r\n"));
		await socket.write(encoder.encode("NICK " + this.user.nick + "\r\nUSER " + this.user.nick + " * * :" + this.user.ident + "\r\n\r\n"));
		while(true){
			
			const buf = new Uint8Array(1024);
			await socket.read(buf);
			const decoded: string = decoder.decode(buf).replace(/\x00|\r/g, "");
			this.readCache.push(decoded);
			if(decoded.substr(-1) == "\n"){
				const parts = this.readCache.join("").split("\n");
				for(const part in parts){
					this.parseData(parts[part]);
				}
				this.readCache.splice(0, this.readCache.length);
			}
		}
	}
	
	
	parseData(data: string){
		//console.log("Data: " + data);
		const bits: string[] = data.split(" ");
		if(bits.length < 2) return;
		
		let cMsg:string = bits[bits.length - 1];
		const source:string = bits[0].substr(1);
		
		
		if(data.indexOf(" :") > 1) cMsg = data.substr(data.indexOf(" :") + 2);
		
		switch(bits[0].toUpperCase()){
			case "PING":
			case ":PING":
				this.sendData("PONG " + bits[1]);
				break;
				
			case "AUTHENTICATE":
				if(bits[1] == "+"){
					/* ready to send SASL auth data */
					this.sendData("AUTHENTICATE " + encodeBase64(this.user + String.fromCharCode(0) + this.user + String.fromCharCode(0) + this.password));
					log("sending login data");
				}
				break;
				
				
		}
		
		switch(bits[1].toUpperCase()){
			case Numerics.RPL_WELCOME:
				this.callback("welcome", data);
				break;
				
            case Numerics.RPL_LOGGEDIN:
                this.sendData("CAP END");
                break;
				
			case Numerics.ERR_SASLFAIL:
				throw new Error("SASL Login error");
				break;

				
				
            case "CAP":
                if(bits[3] == "ACK"){
                    let caps:string[] = cMsg.split(" ");
                    if(caps.includes("sasl")){
                        log("Attempting to authenticate with sasl plain...");
                        this.sendData("AUTHENTICATE PLAIN");
                    }else{
                        this.sendData("CAP END");
                    }
                }
                
                break;
			
			case "JOIN":
				this.callback("join", {source: source, target: bits[2], data: data});
				break;
			
			case "PART":
				this.callback("part", {source: source, target: bits[2], message: cMsg, data: data});
				break;
			
			
			case "PRIVMSG":
				this.callback("privmsg", {source: source, target: bits[2], message: cMsg});
				break;
				
			case "PING":
				this.sendData("PONG " + bits[1]);
				break;
		}
		
		//console.log(bits);
		
		this.callback("data", data);
		
		
	}
	
	callback(name:string, callback: object){
	
		/*
			data
			welcome
			privmsg
			join
			part
		*/
	
		for(let i:string in this.callbackCache){
			if(i == name){
				this.callbackCache[i](callback);
			}
		}
	}
	
	on(name:string, callback: object){
		this.callbackCache[name] = callback;
	}

	join(channel:string, key?:string){
		if(key){
			this.sendData("JOIN " + channel + " :" + key);
		}else{
			this.sendData("JOIN " + channel);
		}
	}
	
	part(channel:string, message:string){
		this.sendData("PART " + channel + " :" + message);	
	}
	
	privmsg(target:string, message:string){
		this.sendData("PRIVMSG " + target.split("!")[0] + " :" + message);
	}
	
	kick(user:string, channel:string, message?:string){
		if(!message) message = "";
		this.sendData("KICK " + channel + " " + user.split("!")[0] + " :" + message);
	}
	
	setModes(target:string, modes:string){
		this.sendData("MODE " + target.split("!")[0] + " :" + modes);
	}
	
	sendData(data:string){
		this.socket.write(encoder.encode(data+"\r\n"));
	}
}

function log(text:string){
	console.log(text);
}

enum Numerics {
    "RPL_WELCOME" = "001",
    "RPL_YOURHOST" = "002",
    "RPL_CREATED" = "003",
    "RPL_MYINFO" = "004",
    "RPL_ISUPPORT" = "005",
    "RPL_MAPMORE" = "006",
    "RPL_MAPEND" = "017",
    "RPL_SNOMASK" = "008",
    "RPL_MAP" = "015",
    "RPL_TRACELINK" = "200",
    "RPL_TRACECONNECTING" = "201",
    "RPL_TRACEHANDSHAKE" = "202",
    "RPL_TRACEUNKNOWN" = "203",
    "RPL_TRACEOPERATOR" = "204",
    "RPL_TRACEUSER" = "205",
    "RPL_TRACESERVER" = "206",
    "RPL_TRACESERVICE" = "207",
    "RPL_TRACENEWTYPE" = "208",
    "RPL_TRACECLASS" = "209",
    "RPL_TRACERECONNECT" = "210",
    "RPL_STATSLINKINFO" = "211",
    "RPL_STATSCOMMANDS" = "212",
    "RPL_STATSCLINE" = "213",
    "RPL_STATSNLINE" = "214",
    "RPL_STATSILINE" = "215",
    "RPL_STATSKLINE" = "216",
    "RPL_STATSPLINE" = "217",
    "RPL_STATSYLINE" = "218",
    "RPL_ENDOFSTATS" = "219",
    "RPL_STATSBLINE" = "220",
    "RPL_UMODEIS" = "221",
    "RPL_SQLINE_NICK" = "222",
    "RPL_STATS_E" = "223",
    "RPL_STATS_D" = "224",
    "RPL_SPAMFILTER" = "229",
    "RPL_SERVICEINFO" = "231",
    "RPL_ENDOFSERVICES" = "232",
    "RPL_SERVICE" = "233",
    "RPL_SERVLIST" = "234",
    "RPL_SERVLISTEND" = "235",
    "RPL_STATSLLINE" = "241",
    "RPL_STATSUPTIME" = "242",
    "RPL_STATSOLINE" = "243",
    "RPL_STATSHLINE" = "244",
    "RPL_STATSSLINE" = "245",
    "RPL_STATSGLINE" = "246",
    "RPL_STATSXLINE" = "247",
    "RPL_STATSULINE" = "248",
    "RPL_STATSDEBUG" = "249",
    "RPL_STATSCONN" = "250",
    "RPL_LUSERCLIENT" = "251",
    "RPL_LUSEROP" = "252",
    "RPL_LUSERUNKNOWN" = "253",
    "RPL_LUSERCHANNELS" = "254",
    "RPL_LUSERME" = "255",
    "RPL_ADMINME" = "256",
    "RPL_ADMINLOC1" = "257",
    "RPL_ADMINLOC2" = "258",
    "RPL_ADMINEMAIL" = "259",
    "RPL_LOCALUSERS" = "265",
    "RPL_GLOBALUSERS" = "266",
    "RPL_WHOISCERTFP" = "276",
    "RPL_HELPHDR" = "290",
    "RPL_HELPOP" = "291",
    "RPL_HELPTLR" = "292",
    "RPL_AWAY" = "301",
    "RPL_ISON" = "303",
    "RPL_ZIPSTATS" = "304",
    "RPL_UNAWAY" = "305",
    "RPL_NOWAWAY" = "306",
    "RPL_WHOISREGNICK" = "307",
    "RPL_WHOISHELPOP" = "310",
    "RPL_WHOISUSER" = "311",
    "RPL_WHOISSERVER" = "312",
    "RPL_WHOISOPERATOR" = "313",
    "RPL_WHOWASUSER" = "314",
    "RPL_ENDOFWHO" = "315",
    "RPL_WHOISIDLE" = "317",
    "RPL_ENDOFWHOIS" = "318",
    "RPL_WHOISCHANNELS" = "319",
    "RPL_WHOISSPECIAL" = "320",
    "RPL_LISTSTART" = "321",
    "RPL_LIST" = "322",
    "RPL_LISTEND" = "323",
    "RPL_CHANNELMODEIS" = "324",
    "RPL_CHANNEL_URL" = "328",
    "RPL_CREATIONTIME" = "329",
    "RPL_WHOISACCOUNT" = "330",
    "RPL_NOTOPIC" = "331",
    "RPL_TOPIC" = "332",
    "RPL_TOPICWHOTIME" = "333",
    "RPL_WHOISBOT" = "335",
    "RPL_WHOISACTUALLY" = "338",
    "RPL_INVITING" = "341",
    "RPL_WHOISCOUNTRY" = "344",
    "RPL_INVITELIST" = "346",
    "RPL_ENDOFINVITELIST" = "347",
    "RPL_EXCEPTLIST" = "348",
    "RPL_ENDOFEXCEPTLIST" = "349",
    "RPL_WHOREPLY" = "352",
    "RPL_NAMEREPLY" = "353",
    "RPL_WHOSPCRPL" = "354",
    "RPL_LINKS" = "364",
    "RPL_ENDOFLINKS" = "365",
    "RPL_ENDOFNAMES" = "366",
    "RPL_BANLIST" = "367",
    "RPL_ENDOFBANLIST" = "368",
    "RPL_ENDOFWHOWAS" = "369",
    "RPL_INFO" = "371",
    "RPL_MOTD" = "372",
    "RPL_ENDOFINFO" = "374",
    "RPL_MOTDSTART" = "375",
    "RPL_ENDOFMOTD" = "376",
    "RPL_WHOISHOST" = "378",
    "RPL_WHOISMODES" = "379",
    "RPL_NOWOPER" = "381",
    "RPL_HOSTCLOAKING" = "396",
    "ERR_NOSUCHNICK" = "401",
    "ERR_NOSUCHSERVER" = "402",
    "ERR_CANNOTSENDTOCHAN" = "404",
    "ERR_TOOMANYCHANNELS" = "405",
    "ERR_WASNOSUCHNICK" = "406",
    "ERR_UNKNOWNCOMMAND" = "421",
    "ERR_NOMOTD" = "422",
    "ERR_NOADMININFO" = "423",
    "ERR_NOOPERMOTD" = "425",
    "ERR_ERRONEOUSNICKNAME" = "432",
    "ERR_NICKNAMEINUSE" = "433",
    "ERR_USERNOTINCHANNEL" = "441",
    "ERR_NOTONCHANNEL" = "442",
    "ERR_USERONCHANNEL" = "443",
    "ERR_NOTREGISTERED" = "451",
    "ERR_NOTENOUGHPARAMS" = "461",
    "ERR_PASSWDMISMATCH" = "464",
    "ERR_YOUREBANNEDCREEP" = "465",
    "ERR_LINKCHANNEL" = "470",
    "ERR_CHANNELISFULL" = "471",
    "ERR_UNKNOWNMODE" = "472",
    "ERR_INVITEONLYCHAN" = "473",
    "ERR_BANNEDFROMCHAN" = "474",
    "ERR_BADCHANNELKEY" = "475",
    "ERR_NOPRIVILEGES" = "481",
    "ERR_CHANOPRIVSNEEDED" = "482",
    "ERR_CANTKILLSERVER" = "483",
    "ERR_ISCHANSERVICE" = "484",
    "ERR_ISREALSERVICE" = "485",
    "ERR_NOOPERHOST" = "491",
    "ERR_CANNOTSENDTOUSER" = "531",
    "RPL_WHOISASN" = "569",
    "RPL_STARTTLS" = "670",
    "RPL_WHOISSECURE" = "671",
    "RPL_HELPSTART" = "704",
    "RPL_HELPTXT" = "705",
    "RPL_ENDOFHELP" = "706",
    "RPL_OMOTDSTART" = "720",
    "RPL_OMOTD" = "721",
    "RPL_ENDOFOMOTD" = "722",
    "RPL_MONONLINE" = "730",
    "RPL_MONOFFLINE" = "731",
    "RPL_MONLIST" = "732",
    "RPL_ENDOFMONLIST" = "733",
    "ERR_MONLISTFULL" = "734",
    "RPL_LOGGEDIN" = "900",
    "RPL_LOGGEDOUT" = "901",
    "ERR_NICKLOCKED" = "902",
    "RPL_SASLLOGGEDIN" = "903",
    "ERR_SASLFAIL" = "904",
    "ERR_SASLTOOLONG" = "905",
    "ERR_SASLABORTED" = "906",
    "ERR_SASLALREADYAUTHED" = "907",
    "ERR_CANNOTDOCOMMAND" = "972"
}

/*
MIT License

Copyright (c) 2005 Matthew Ryan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/