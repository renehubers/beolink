var Gpio= require('onoff').Gpio;
var redis= require('redis')
var client= redis.createClient();

function Beolink(port, btnHandler)
{
    this.handler= btnHandler;
	this.lasttime= process.hrtime();
	this.decoding= 0;
	this.lastbit= 0;
	this.bits= [];
	this.cnt= 0;
	this.lastcode= '';
	this.pending= null;
	this.pendingcode= null;
	this.source= 'STDBY';
	this.lastsource= '';
	this.ir= new Gpio(port,'in','rising');
	this.numbers= '';
	this.start= process.hrtime();
	this.lastbutton=''
	var self= this;
	
	this.ir.watch(function (err, value) {
		if (err) {
			throw err;
		}
		self.gotkey();
	});

	this.gotkey= function() {
		var self= this;
		var elapsed= process.hrtime(self.lasttime);
		self.lasttime= process.hrtime();
		var t= parseInt((elapsed[1] / 1000000 / 3.125) + 0.5, 10);
		if (elapsed[0] + t > 5 || t == 0 || (t == 5 && self.decoding) || (t < 5 && !self.decoding)) {
			self.decode_end();
			return;
		}
		
		if (t==5) {
			self.decode_start();
		}
		else if (t==4) {
			if (self.bits.length==17) {
				var code= self.bits.join('');
				if (code != self.lastcode) {
					self.cnt= 0;
					self.lastcode= code;
				}
				var code2= [code.substr(0,4).bin2hex(),
							code.substr(4,5).bin2hex(),
							code.substr(9,8).bin2hex()];
				const button= self.buttons[code2[2]];
				if (button) self.recode(button, process.hrtime())
				//self.recode(code2);
				//self.callback(code2);
			}
			self.decode_end();
		}
		else {
			var bit= t - (self.lastbit==0?2:1);
			if (bit < 0 || bit > 1) {
				self.decode_end();
			} else {
				self.lastbit= bit;
				self.bits.push(bit);
			}
		}
	}

	this.decode_start= function() {
		this.decoding= 1;

		this.lastbit= 1;
		this.bits= [];	
	}
	
	this.decode_end= function() {
		this.decoding= 0;
	}

	this.clearTimers= function() {
		var self= this
		if (self.pending) {
			clearTimeout(self.pending)
			self.pending= null
		}
	}
	
	this.recode= function(code) {
		var self= this;
		var elapsed= process.hrtime(self.start)
		self.start= process.hrtime()
		var t= elapsed[0]+elapsed[1]/1000000000
		var newbutton= code

		if (code.match(/[0-9]/)) {
			self.numbers+= code;
			newbutton= null
			this.clearTimers()
			self.pending= setTimeout(() => {
				self.pending= null
				this.recode('GOTO')
			}, 1700);
		} else if (code == 'GOTO' && self.numbers != '') {
			newbutton= self.numbers
			self.numbers= ''
			this.clearTimers()
		} else if (code.match(/^(GO|RED|YELLOW|GREEN|BLUE)$/) && self.numbers != '') {
			newbutton= code + '+' + self.numbers
			self.numbers= ''
			this.clearTimers()
		}

		if (newbutton != null)
		{
			self.callback(newbutton)
		}
	}

	this.callback= function(code) {
		client.publish('beolink', JSON.stringify({source: self.source, key: code}));
		client.publish(self.source, code);
		if (code == 'EXIT' && self.source == 'LIGHT') {
			self.source= self.lastsource;
		} 
		if (code.match(/^(TV|LIGHT|RADIO|PHONO|A.AUX|SAT|DVD|CD|V.TAPE|A.TAPE|STDBY)$/)) {
			self.lastsource= self.source;
			self.source= code;
		} 
		self.handler(self.source,code);
	}
	
	this.buttons= {
		'80': 'TV',
		'81': 'RADIO',
		'82': 'V.AUX',
		'83': 'A.AUX',
		'85': 'V.TAPE',
		'9B': 'LIGHT',
		'8A': 'SAT',
		'8B': 'PC',
		'86': 'DVD',
		'91': 'A.TAPE',
		'92': 'CD',
		'93': 'PHONO',
		'94': 'A.TAPE2',
		'97': 'CD2',
		'37': 'RECORD',
		'00': '0',
		'01': '1',
		'02': '2',
		'03': '3',
		'04': '4',
		'05': '5',
		'06': '6',
		'07': '7',
		'08': '8',
		'09': '9',
		'C0': 'SHIFT+0',
		'C1': 'SHIFT+1',
		'C2': 'SHIFT+2',
		'C3': 'SHIFT+3',
		'C4': 'SHIFT+4',
		'C5': 'SHIFT+5',
		'C6': 'SHIFT+6',
		'C7': 'SHIFT+7',
		'C8': 'SHIFT+8',
		'C9': 'SHIFT+9',
		'88': 'TEXT',
		'5C': 'MENU',
		'1E': 'UP',
		'72': 'UP.REPEAT',
		'1F': 'DOWN',
		'73': 'DOWN.REPEAT',
		'32': 'LEFT',
		'70': 'LEFT.REPEAT',
		'34': 'RIGHT',
		'71': 'RIGHT.REPEAT',
		'D5': 'GREEN',
		'76': 'GREEN.REPEAT',
		'D4': 'YELLOW',
		'77': 'YELLOW.REPEAT',
		'D9': 'RED',
		'79': 'RED.REPEAT',
		'D8': 'BLUE',
		'78': 'BLUE.REPEAT',
		'35': 'GO',
		'75': 'GO.REPEAT',
		'58': 'LIST',
		'7F': 'EXIT',
		'36': 'STOP',
		'60': 'VOLUME+',
		'64': 'VOLUME-',
		'0D': 'MUTE',
		'0C': 'STDBY',
	};

}
module.exports= Beolink;
String.prototype.bin2hex = function ()
{

  var hex= parseInt(this,2).toString(16);
  if (hex.length < 2) hex= '0' + hex;
  return hex.toUpperCase();
}
