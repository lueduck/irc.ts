
# IRC.TS

An IRC module written in TypeScript for use with Deno. This project is in alpha stage and is not ready for production use. 

# Usage

First include the module in your project

```
import { IRC } from "./irc.ts";
```

Then create an IRC connection

```
const irc:object = new IRC({
    nick: "MyIRCBot", 
    user: "", 
    password: "", 
    ident: "Testing"
    }, "irc.libera.chat", 6667);
```

Wait for welcome from IRC, then join a channel

```
irc.on("welcome", (e)=>{
	irc.join("##defocus");
});
```
