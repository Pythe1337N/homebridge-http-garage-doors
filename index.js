'use strict';

const fetch = require('node-fetch');

var Service, Characteristic;

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory('homebridge-http-garage-doors', 'HttpGarageDoors', HttpGarageDoorsAccessory);
};

class HttpGarageDoorsAccessory {
  constructor (log, config) {
    this.log = log;

    const {
      debug,
      request,
      simulateTimeOpen,
      simulateTimeClosing,
      device = {}
    } = config;

    const {
      manufacturer = 'METATAG',
      model = 'HTTP_GARAGE_GATES',
      serialNumber = '00000001'
    } = device;

    this.debug = debug;

    this.request = request;
    
    this.simulateTimeOpen = simulateTimeOpen;
    this.simulateTimeClosing = simulateTimeClosing;

    this.service = new Service.GarageDoorOpener(config['name'], config['name']);
    this.setupGarageDoorOpenerService(this.service);

    this.informationService = new Service.AccessoryInformation();
    this.informationService
        .setCharacteristic(Characteristic.Manufacturer, manufacturer)
        .setCharacteristic(Characteristic.Model, model)
        .setCharacteristic(Characteristic.SerialNumber, serialNumber);

    this.targetDoorState = Characteristic.TargetDoorState.CLOSED;
    this.currentDoorState = Characteristic.CurrentDoorState.CLOSED;
    
    this.closingTimer = undefined;
    this.closedTimer = undefined;
  }

  getServices () {
    return [this.informationService, this.service];
  }

  setupGarageDoorOpenerService (service) {
    this.service.setCharacteristic(Characteristic.TargetDoorState, this.targetDoorState);
    this.service.setCharacteristic(Characteristic.CurrentDoorState, this.currentDoorState);

    service.getCharacteristic(Characteristic.CurrentDoorState)
        .on('get', (callback) => {
          callback(null, this.currentDoorState)
        })

    service.getCharacteristic(Characteristic.TargetDoorState)
        .on('get', (callback) => {
          callback(null, this.targetDoorState);
        })
        .on('set', async (value, callback) => {
          if (value === Characteristic.TargetDoorState.OPEN) {
            this.targetDoorState = value;
            this.lastOpened = Date.now();
            await this.open();
          }
          callback();
        });
  }
  
  async open() {
    this.currentDoorState = Characteristic.CurrentDoorState.OPENING;
    await this.fetchRequest(this.request);
    this.currentDoorState = Characteristic.CurrentDoorState.OPEN;
    
    clearTimeout(this.closingTimer);
    clearTimeout(this.closedTimer);
    
    this.closingTimer = setTimeout(() => {
      this.currentDoorState = Characteristic.CurrentDoorState.CLOSING;
    }, this.simulateTimeOpen * 1000);
    
    this.closedTimer = setTimeout(() => {
      this.currentDoorState = Characteristic.CurrentDoorState.CLOSED;
    }, (this.simulateTimeOpen + this.simulateTimeClosing) * 1000);
  }

  async fetchRequest(request) {
    if (typeof request.options?.body === 'object') {
      request.options.body = JSON.stringify(request.options.body);
      request.headers = {...(request.headers || {}), 'Content-Type': 'application/json'};
    }
    await fetch(request.url, request.options);
  }
  
}
