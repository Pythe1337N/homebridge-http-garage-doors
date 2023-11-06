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
    this.logger = log;

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
    this.obscrution = false;
    
    this.closingTimer = undefined;
    this.closedTimer = undefined;
  }

  getServices () {
    return [this.informationService, this.service];
  }
  
  log(str) {
    if (this.debug) {
      this.logger(str);
    }
  }

  setupGarageDoorOpenerService (service) {
    this.service.setCharacteristic(Characteristic.TargetDoorState, this.targetDoorState);
    this.service.setCharacteristic(Characteristic.CurrentDoorState, this.currentDoorState);
    this.service.setCharacteristic(Characteristic.ObstructionDetected, this.obscrution);

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
            await this.open();
          }
          callback();
        });
  }

  setCurrentDoorState(state) {
    this.currentDoorState = state;
    this.service.getCharacteristic(Characteristic.CurrentDoorState).updateValue(this.currentDoorState);
  }

  setTargetDoorState(state) {
    this.targetDoorState = state;
    this.service.getCharacteristic(Characteristic.TargetDoorState).updateValue(this.targetDoorState);
  }
  
  setObstruction(state) {
    this.obscrution = state;
    this.service.getCharacteristic(Characteristic.ObstructionDetected).updateValue(this.obscrution);
  }
  
  async open() {
    const states = Characteristic.CurrentDoorState;
    this.setCurrentDoorState(states.OPENING);
    try {
      const response = await this.fetchRequest(this.request);
      if (response.errors) {
        throw new Error(response.errors);
      }
      this.setObstruction(false);
    } catch (e) {
      this.setObstruction(true);
      this.logger(e);
    }
    this.setCurrentDoorState(states.OPEN);
    
    clearTimeout(this.closingTimer);
    clearTimeout(this.closedTimer);
    
    this.closingTimer = setTimeout(() => {
      this.setTargetDoorState(Characteristic.TargetDoorState.CLOSED)
      this.setCurrentDoorState(states.CLOSING);
    }, this.simulateTimeOpen * 1000);
    
    this.closedTimer = setTimeout(() => {
      this.setCurrentDoorState(states.CLOSED);
    }, (this.simulateTimeOpen + this.simulateTimeClosing) * 1000);
  }

  async fetchRequest(request) {
    if (typeof request.options?.body === 'object') {
      request.options.body = JSON.stringify(request.options.body);
      request.options.headers = {...(request.options.headers || {}), 'Content-Type': 'application/json'};
    }
    
    this.log(request.url, request.options);
    
    const response = await fetch(request.url, request.options);
    const json = await response.json();
    
    this.log(json);
    return json;
  }
  
}
