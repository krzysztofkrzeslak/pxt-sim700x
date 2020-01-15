/**
 * SIM700x block
 */

//% color=#5042f4 icon="\uf093"
namespace SIM700x {

	let _SIM700TX_Pin=SerialPin.P1
	let _SIM700RX_Pin=SerialPin.P0
	let _SIM700BaudRate=BaudRate.BaudRate115200
	let usbLogging = false
	let _Apn_name=""

	/**
	* (internal function)
	*/
	function _SendATCommand(atCommand: string, timeout=1000, useNewLine=true, additionalWaitTime=1000): string {
			if(useNewLine){
				serial.writeLine(atCommand)
			}else{
				serial.writeString(atCommand)
			}

			let startTs = input.runningTime()
			let buffer = ""
			while ( (input.runningTime() - startTs <= timeout) || (timeout==-1) ) { //read until timeout is not exceeded
				buffer += serial.readString()
				if (buffer.includes("OK") || buffer.includes("ERROR")) { //command completed, modem responded
		  		break
				}
			}
		if(usbLogging){
			USBSerialLog("Command: "+atCommand+"\r\nResponse: "+buffer)
		}
		return buffer
	}

	/**
	* (internal function)
	*/
	function _SendATCommandCheckACK(atCommand: string, limit=5): boolean {
			let tries=0
			let modemResponse = _SendATCommand(atCommand,-1)
			while(!modemResponse.includes("OK")){
					if(tries>limit){
						return false
					}
					modemResponse = _SendATCommand(atCommand,-1)
					basic.pause(100*tries) //adaptively extend pause during sending commands which fail
					tries++

			}
			return true
	}

	/**
	* Init module
	*/
	//% weight=100 blockId="SIM700Init"
	//% block="SIM700x Init RX: %SIM700RX_Pin TX: %SIM700TX_Pin Baud:%SIM700BaudRate"
	//% SIM700TX_Pin.defl=SerialPin.P1 SIM700RX_Pin.defl=SerialPin.P0 SIM700BaudRate.defl=BaudRate.BaudRate115200 group="1. Setup: "
	export function Init(SIM700TX_Pin: SerialPin, SIM700RX_Pin: SerialPin, SIM700BaudRate: BaudRate) {
			_SIM700RX_Pin=SIM700RX_Pin
			_SIM700TX_Pin=SIM700TX_Pin
			_SIM700BaudRate=SIM700BaudRate

			serial.redirect(_SIM700RX_Pin, _SIM700TX_Pin, _SIM700BaudRate)
			serial.setWriteLinePadding(0)
			serial.setRxBufferSize(128)

			let atResponse = _SendATCommand("AT")
			while(!atResponse.includes("OK")){ //check in loop if echo is enabled
				atResponse = _SendATCommand("AT",1000)
			}
			_SendATCommand("ATE 0") // disable echo
			_SendATCommand("AT+CMEE=2") // extend error logging
	}

	/**
	* get signal strength,
	* return in 1-5 range
	* return -1 if something is wrong and signal can't be fetched
	*/
	//% weight=100 blockId="getSignalQuality"
	//% block="SIM700x GetSignalQuality" group="2. Status: "
	export function getSignalQuality(): number {
			let signalStrengthRaw = _SendATCommand("AT+CSQ")
			let signalStrengthLevel = -1
			if (signalStrengthRaw.includes("+CSQ:")) {
				signalStrengthRaw = signalStrengthRaw.split(": ")[1]
				signalStrengthRaw = signalStrengthRaw.split(",")[0]
				if(parseInt(signalStrengthRaw) != 99){ // 99 means that signal can't be fetched
					signalStrengthLevel = Math.round(Math.map(parseInt(signalStrengthRaw), 0, 31, 1, 5))
				}
			}
			return signalStrengthLevel
	}

	/**
	* Display signal strength on led matrix
	*/
	//% weight=100 blockId="displaySignalQuality"
	//% block="SIM700x DispalySignalQuality" group="2. Status: "
	export function displaySignalQuality() {
		let signalQuality = getSignalQuality()
		if (signalQuality == 1) {
				basic.showLeds(`. . . . .\n. . . . .\n. . . . .\n. . . . .\n# . . . .`)
		}
		if (signalQuality == 2) {
				basic.showLeds(`. . . . .\n. . . . .\n. . . . .\n. # . . .\n# # . . .`)
		}
		if (signalQuality == 3) {
				basic.showLeds(`. . . . .\n. . . . .\n. . # . .\n. # # . .\n# # # . .`)
		}
		if (signalQuality == 4) {
				basic.showLeds(`. . . . .\n. . . . .\n. . # . .\n. # # . .\n# # # . .`)
		}
		if (signalQuality == 5) {
				basic.showLeds(`. . . . #\n. . . # #\n. . # # #\n. # # # #\n# # # # #`)
		}
	}

	/**
	* return gsm network registration status as code, 1 or 5 mean sucessfull registartion
	*/
	//% weight=100 blockId="getGSMRegistrationStatus"
	//% block="SIM700x GetGSMRegistrationStatus" group="2. Status: "
	export function getGSMRegistrationStatus(): number {
			let response = _SendATCommand("AT+CREG?")
			let registrationStatusCode = -1;
			if (response.includes("+CREG:")) {
				response = response.split(",")[1]
				registrationStatusCode = parseInt(response.split("\r\n")[0])

			}
			return registrationStatusCode
	}

	/**
	*  Send sms message
	*  Phone number must be in format: "+(country code)(9-digit phone number)" eg. +48333222111
	*/
	//% weight=100 blockId="sendSmsMessage"
	//% block="SIM700x sendSmsMessage to: %phone_num, content: %content " group="3. GSM: "
	export function sendSmsMessage(phone_num: string, content: string) {
			_SendATCommand("AT+CMGF=1") // set text mode
			_SendATCommand('AT+CMGS="' + phone_num + '"')
			_SendATCommand(content + "\x1A")
	}

	/**
	*get gurrent date and time as string
	*format is "yy/MM/dd,hh:mm:ss±zz"
	*example "10/05/06,00:01:52+08
	*/
	//% weight=100 blockId="getDateAndTime"
	//% block="SIM700x getDateAndTime" group="3. GSM: "
	export function getDateAndTime(): string {
			_SendATCommand("AT+CLTS=1") // enable in case it's not enabled
			let modemResponse=_SendATCommand('AT+CCLK?')
			if(modemResponse.includes('+CCLK:')){
				let dateTime=modemResponse.split('"')[1]
				return dateTime
			}
			return "Err"

	}



	//MQTT
	//global mqtt variables below
	let mqttSubscribeHandler=function(topic: string, message: string){}
	let mqttSubscribeTopics: string[] = []

	/**
	* Mqtt init
	*/
	//% weight=100 blockId="SIM700MqttInit"
	//% block="SIM700x MQTT init: APNname:%ApnName" group="4. MQTT:"
	export function MqttInit(ApnName: string) {
		_Apn_name = ApnName
		let gsmStatus=getGSMRegistrationStatus()
		while(!(gsmStatus==1 || gsmStatus==5)){
			gsmStatus=getGSMRegistrationStatus()
			basic.pause(500)
		}
		_SendATCommand('AT+CNACT=1,"'+ApnName+'"')
		basic.pause(1000)
		let netStatus=_SendATCommand('AT+CNACT?')
		let tries = 0
		while(!netStatus.includes("+CNACT: 1")){
			if(tries>=8){
				_SendATCommand('AT+CNACT=1,"'+ApnName+'"')
				tries=0
			}
			basic.pause(1000)
			netStatus=_SendATCommand('AT+CNACT?')
			tries++
		}
	}

	/**
	* MQTT connect
	*/
	//% weight=100 blockId="SIM700InitMQTT"
	//% block="SIM700x MQTT connect BrokerUrl:%brokerUrl brokerPort:%brokerPort clientId:%clientId username:%username passwd:%password" group="4. MQTT:"
	export function MqttConnect(brokerUrl: string, brokerPort: string, clientId: string, username: string, password: string) {
		_SendATCommandCheckACK('AT+SMCONF="URL","'+brokerUrl+'","'+brokerPort+'"')
		_SendATCommandCheckACK('AT+SMCONF="CLIENTID","'+clientId+'"')
		_SendATCommandCheckACK('AT+SMCONF="USERNAME","'+username+'"')
		_SendATCommandCheckACK('AT+SMCONF="PASSWORD","'+password+'"')
		if(! _SendATCommandCheckACK("AT+SMCONN",2)){
			_SendATCommand("AT+SMDISC") //try to disconnect first if connection failed
			_SendATCommandCheckACK("AT+SMCONN") //try to connect second time
		}
	}

	/**
	* MQTT publish message
	*/
	//% weight=100 blockId="SIM700MqttPublish"
	//% block="SIM700x MQTT publish topic:%brokerUrl message:%message||qos:%qos retain:%retain" group="4. MQTT:"
	//% qos.defl=1 retain.defl=0 expandableArgumentMode="toggle"
	export function MqttPublish(topic: string, message: string, qos=1, retain=0) {
			let cmd='AT+SMPUB="'+topic+'",' + (message.length) + ','+qos+','+retain
			_SendATCommand(cmd,100)
			basic.pause(100)

			let modemResponse=_SendATCommand(message,3000,false)

			let tries=0
			while((modemResponse.includes("ERROR") || modemResponse.includes("SMSTATE: 0")) && (!(tries>6)) ){
				let modemNetState=_SendATCommand("AT+CNACT?",-1)
				let mqttConnectionState=_SendATCommand("AT+SMSTATE?",-1)
				if(modemNetState.includes("+CNACT: 0") ){
					//network seem disconnected, try to reinit
					MqttInit(_Apn_name)
					_SendATCommandCheckACK("AT+SMCONN")
				}
				if(mqttConnectionState.includes("+SMSTATE: 0")){
					//seem like mqtt disconnection,try to reconnect
					_SendATCommand("AT+SMDISC")
					_SendATCommandCheckACK("AT+SMCONN")
				}
				//retry message publishing
				_SendATCommand(cmd,100)
				modemResponse=_SendATCommand(message,5000,false)

				tries++
			}

	}

	/**
	* MQTT subscribe
	*/
	//% weight=100 blockId="SIM700SubscribeMQTT"
	//% block="SIM700x MQTT subscribe topic:%topic" group="4. MQTT:"
	export function MqttSubscribe(topic: string) {
		_SendATCommand('AT+SMSUB="'+topic+'",1')
		mqttSubscribeTopics.push(topic)

		//attach listener
		serial.onDataReceived("+", function () {
			basic.pause(50)
			let dataRaw = serial.readString()
			let data = dataRaw.substr(dataRaw.indexOf("+"),dataRaw.length)
			if(data.includes("SMSUB:")){
				for(let i=0; i<mqttSubscribeTopics.length; i++){
					if(data.includes(mqttSubscribeTopics[i])){
						let message = (data.split('","')[1]) // extract message from AT Response
						mqttSubscribeHandler(mqttSubscribeTopics[i], message.slice(0,-3))
					}
				}
			}
		})
	}


	/**
	* MQTT on subscription receive
	*/
	//% weight=100 blockId="SIM700SubsMsgReceivedMQTT"
	//% block="SIM700x MQTT on subscribtion received" group="4. MQTT:"
	//% draggableParameters
	export function MqttMessageReceived(handler: (topic: string, message: string) => void) {
		mqttSubscribeHandler = handler
	}


	/**
	* MQTT live object publish message
	*/
	//% weight=100 blockId="SIM700MqttLiveObjectPublish"
	//% block="SIM700x Live object publish stream:%stream, timestamp:%timestamp data:%data" group="4. MQTT:"
	export function LiveObjectPublish(stream: string,timestamp: string, data: string[]) {
		let dataString = ''
		for(let i=0; i<data.length; i++){
	    		dataString+=',"'+i+'":"'+data[i]+'"'

		}

		let liveObjectMsg = '{ "s":"'+stream+'", "v": { "timestamp":"'+timestamp+'"'+dataString+'} }'
		MqttPublish("dev/data",liveObjectMsg)
	}



		/**
		* Http init
		*/
		//% weight=100 blockId="SIM700InitHTTP"
		//% block="SIM700x HTTP init apn:%apnName" group="5. HTTP:"
		export function HttpInit(apnName: string) {
			_SendATCommandCheckACK('AT+SAPBR=3,1,"APN","'+apnName+'"')
			_SendATCommandCheckACK('AT+SAPBR=1,1')
			_SendATCommandCheckACK('AT+SAPBR=2,1')
			if(! _SendATCommandCheckACK('AT+HTTPINIT') ){
				_SendATCommandCheckACK('AT+HTTPTERM')
				_SendATCommandCheckACK('AT+HTTPINIT')
			}
		}

		/**
		* Http post
		*/
		//% weight=100 blockId="SIM700HTTPPost"
		//% block="SIM700x HTTP post url:%url data:%data" group="5. HTTP:"
		export function HttpPost(url: string, data: string) {
			_SendATCommandCheckACK('AT+HTTPPARA="URL","'+url+'"')
			_SendATCommand("AT+HTTPDATA="+data.length+",1000")
			basic.pause(100)
			_SendATCommand(data,1000,false)
			_SendATCommandCheckACK('AT+HTTPACTION=1')
		}


	/**
	* GPS init
	*/
	//% weight=100 blockId="SIM700InitGPS"
	//% block="SIM700x GPS init" group="6. GPS:"
	export function InitGPS() {
		_SendATCommandCheckACK("AT+CGNSPWR=1")
	}

	/**
	* GNSS get position
	*/
	//% weight=100 blockId="SIM700GPSPosition"
	//% block="SIM700x GPS get position" group="6. GPS:"
	export function GPSGetPosition(): string {
		let modemResponse=_SendATCommand("AT+CGNSINF")
		let position = ""
		while(!modemResponse.includes("+CGNSINF: 1,1")){
			basic.pause(500)
			modemResponse=_SendATCommand("AT+CGNSINF")
		}
	  let tmp=modemResponse.split(",")
		position = tmp[3]+","+tmp[4]
		return position
	}

	/**
	* log debug message using usb serial connection
	*/
	//% weight=100 blockId="SIM700USBSerialLog"
	//% block="USBSerialLog %message"
	//% group="7. Low level  and debug functions:"
	export function USBSerialLog(message: string) {
		serial.redirectToUSB()
		serial.writeLine(message)
		serial.redirect(_SIM700RX_Pin, _SIM700TX_Pin, _SIM700BaudRate)
	}

	/**
	* Send plain AT command to modem and return response from it
	*/
	//% weight=100 blockId="SendATCommand"
	//% block="SIM700x SendATCommand %atCommand || timeout:%timeout"
	//% timeout.defl=1000 expandableArgumentMode="toggle"
	//% group="7. Low level  and debug functions:"
	export function SendATCommand(atCommand: string, timeout?: number): string {
		if(timeout){
			return _SendATCommand(atCommand,timeout)
		}else{
			return _SendATCommand(atCommand)
		}

	}


}
