var Gpio= require('onoff').Gpio;
var redis= require('redis')
var client= redis.createClient();

function Beolink(port)
{
 //   this.handler= btnHandler;
	this.lasttime= process.hrtime();
	this.decoding= 0;
	this.lastbit= 0;
	this.bits= [];
	this.cnt= 0;
	this.lastcode= '';
	this.pending= null;
	this.pendingcode= '';
	this.source= 'STDBY';
	this.lastsource= '';
	this.ir= new Gpio(port,'in','rising');
	this.numbers= '';
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
				code2[3]= self.buttons[code2[2]];
				self.recode(code2);
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
	
	this.recode= function(code) {
		var self= this;
		self.callback(code);
		return;
		if (code[3] && code[3].match(/^(MENU|GO)$/)) {
			if (self.pending) {
				clearTimeout(self.pending);
				self.pending= null;
				if (self.numbers.length > 0) {
					code[3]= self.numbers;
					self.numbers= '';
				} 
				self.callback(code);
			} else {
				self.pendingcode= code[3];
				self.pending= setTimeout(function(code) {
					self.pending= null;
					self.callback(code);
				}, 1700, code);
			}
		} else if (self.pending && code[3] && code[3].match(/^(LEFT|RIGHT|UP|DOWN)$/)) {
			clearTimeout(self.pending);
			self.pending= null;
			code[3]=self.pendingcode+'+'+code[3];
			self.callback(code);
		} else if (code[3] != null  && code[3].match(/[0-9]/)) {
			if (self.pending) {
				clearTimeout(self.pending);
			}
			self.numbers+= code[3];
			code[3]= self.numbers;
			self.pending= setTimeout(function(code) {
				self.pending= null;
				self.callback(code);
				self.numbers= '';
			}, 1700, code);
		} else {
			self.callback(code);
		}
	}

	this.callback= function(code) {
		if (!code[3]) code[3]= code[2];
		if (code[3].match(/^(TV|LIGHT|RADIO|PHONO|A.AUX|SAT|DVD|CD|V.TAPE|A.TAPE|STDBY)$/)) {
			self.lastsource= self.source;
			self.source= code[3];
		} 
		client.publish('beolink', JSON.stringify({source: self.source, key: code[3]}));
		client.publish(self.source, code[3]);
		if (code[3] == 'EXIT' && self.source == 'LIGHT') {
			self.source= self.lastsource;
		} 

		//self.handler(self.source,code[3]);
	
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
		'60': 'VOLUMEUP',
		'64': 'VOLUMEDOWN',
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
