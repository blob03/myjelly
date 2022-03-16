/* eslint-disable indent */
import ServerConnections from '../../../components/ServerConnections';
import { ajax } from '../../../components/fetchhelper';
import * as userSettings from '../../../scripts/settings/userSettings';
import globalize from '../../../scripts/globalize';
import datetime from '../../../scripts/datetime';
import loading from '../../../components/loading/loading';

function show(item, visible) {
	if (!item || typeof visible != "boolean")
		return;
	let els = document.getElementsByClassName(item);
	if (els.length) {
		Array.prototype.forEach.call(els, function(el) {
			visible === true? el.classList.remove('hide') : el.classList.add('hide');
		});
	}
}

export default function () {
    const self = this;

	self.name = 'The Weatherbot';
	self.group = 'myJelly';
	self.version = '0.6';
	self.description = 'WeatherbotScreensaverHelp';
	self.type = 'screensaver';
	self.id = 'weatherbotscreensaver';
	self.supportsAnonymous = false;
	self.hideOnClick = true;
	self.hideOnMouse = true;
	self.hideOnKey = true;
	self.interval = null;
	self.opts = {};
	
	function weather(self) {	

		loading.show();
		
		// Note that API keys can be obtained free of charge by registering at the address below
		// https://home.openweathermap.org/users/sign_up
		// Remember to copy any new key into its dedicated field in the display settings.
		let req = {};
		req.dataType = 'json';
		const url_base = 'http://api.openweathermap.org/data/2.5/';
		const url_apiMethod = 'weather';
		const url_params = '?appid=' + self.opts.apikey 
		+ '&lat=' + self.opts.lat + '&lon=' + self.opts.lon
		+ '&units=' + (self.opts.USUnits === true?'imperial':'metric') + '&lang=' + self.opts.dateTimeLocale;
		req.url = url_base + url_apiMethod + url_params; 
		
		ajax(req).then(function (data) {
			show('ssFailure', false);

			if (data.name)
				self.opts.locationstr.innerHTML = data.name;
			self.opts.location2str.innerHTML = "";
			if (data.sys.country)
				self.opts.location2str.innerHTML += data.sys.country;
			if (data.weather["0"].description)
				self.opts.conditionstr.innerHTML = data.weather["0"].description;
			if (data.main.temp)
				self.opts.tempstr.innerHTML = data.main.temp;
			if (data.main.humidity)
				self.opts.humstr.innerHTML = data.main.humidity;
			if (data.visibility) {
				let vis = data.visibility;
				if (self.opts.USUnits)
					vis = vis/1609; // miles
				else
					vis = vis/1000; // km
				self.opts.visistr.innerHTML = Number(vis.toFixed(2));
			}
			if (data.wind.speed) {
				let wspeed = data.wind.speed;
				if (!self.opts.USUnits)
					wspeed *= 3.6; // m/s -> km/h
				self.opts.windstr.innerHTML = Number(wspeed.toFixed(2));
			}
			self.opts.windirstr.innerHTML = "";
			if (data.wind.deg)
				self.opts.windirstr.innerHTML += data.wind.deg + '&deg;'
			
			show('ssForeplane', true);
			loading.hide();
			
		}).catch(function (data) {
			console.warn(data);
			show('ssForeplane', false);
			self.opts.msgstr.innerHTML = data.status + '<br/>' + data.statusText;
			
			show('ssFailure', true);
			loading.hide();
		});
	}

    function stopInterval() {
        if (self.interval) {
            clearInterval(self.interval);
            self.interval = null;
        }
		show('ssFailure', false);
		show('ssForeplane', false);
    }

    self.show = function (TEST) {
		// If another instance is running, return.
		if (self.interval !== null) 
			return;
		
        import('./style.scss').then(() => {
			
			// When tested, use the relevant parameters as they are currently set in the settings page
			// rather than the ones saved.
			self.opts = {};
	
			if (TEST === true) {
				self.hideOnMouse = false;
				// Get currently selected Locale.
				self.opts.dateTimeLocale = document.querySelector('.selectDateTimeLocale').value;
				// If set to 'auto' then use the language.
				if (self.opts.dateTimeLocale === "")
					self.opts.dateTimeLocale = document.querySelector('.selectLanguage').value;
				// If display language is also set to 'auto' then request the default value.
				if (self.opts.dateTimeLocale === "")
					self.opts.dateTimeLocale = globalize.getDefaultCulture();
				// Get an API key from the form.
				self.opts.apikey = document.querySelector('#inputApikey').value || "";
				self.opts.USUnits = document.querySelector('#chkuseUSUnits').checked;
				self.opts.lat = document.querySelector('#inputLat').value || '78.69';
				self.opts.lon = document.querySelector('#inputLon').value || '15.72';
			} else {
				self.hideOnMouse = true;
				// get the last saved API key.
				self.opts.apikey = userSettings.weatherApiKey() || "";
				self.opts.dateTimeLocale = globalize.getCurrentDateTimeLocale();
				self.opts.USUnits = userSettings.enableUSUnits() || false;
				self.opts.lat = userSettings.getlatitude();
				self.opts.lon = userSettings.getlongitude();
			}
				
			stopInterval();
			
			let elem = document.querySelector('.weatherbotScreenSaver');
            if (!elem) {
                elem = document.createElement('div');
                elem.classList.add('weatherbotScreenSaver');
                document.body.appendChild(elem);
				let content ='<div class="ssBackplane">'
				+ '<div class="ssFailure hide">'
				+ '<span id="ssMsg" class="ssWeatherData"></span>'
				+ '</div>'
				+ '<div class="ssForeplane hide">'
				+ '<span id="ssLoc" class="ssWeatherData"></span>'
				+ '</div>'
				+ '<div class="ssForeplane hide">'
				+ '<span id="ssLoc2" class="ssWeatherData ssWeatherDataSmall"></span>'
				+ '</div>'
				+ '<div class="ssForeplane hide">'
				+ '<span id="ssCond" class="ssWeatherData ssWeatherDataSmall"></span>'
				+ '</div>'
				+ '<div class="ssForeplane hide">'
				+ '<span class="material-icons thermostat"></span>'
				+ '<span id="ssTemp" class="ssWeatherData"></span>';
				
				if (self.opts.USUnits)
					content += '<span class="ssWeatherDataUnit">&#8457;</span>';
				else
					content += '<span class="ssWeatherDataUnit">&#8451;</span>';
				
				content += '&nbsp;<span class="material-icons water_drop">'
				+ '</span><span id="ssHum" class="ssWeatherData"></span>'
				+ '<span class="ssWeatherDataUnit">%</span>'
				+ '&nbsp;<span class="material-icons visibility">'
				+ '</span><span id="ssVisi" class="ssWeatherData"></span>';	
				
				if (self.opts.USUnits)
					content += '<span class="ssWeatherDataUnit">miles</span>';		
				else
					content += '<span class="ssWeatherDataUnit">km</span>';
				
				content += '</div>'
				+ '<div class="ssForeplane hide">'
				+ '<span class="material-icons air"></span>'
				+ '<span id="ssWind" class="ssWeatherData"></span>';
				
				if (self.opts.USUnits)
					content += '<span class="ssWeatherDataUnit">mph</span>';
				else
					content += '<span class="ssWeatherDataUnit">km/h</span>';
				
				content += '<span id="ssWindir" class="ssWeatherData ssWeatherDataSmall"></span>'
				+ '</div>'
				+ '</div>';
				
				elem.innerHTML = content;
            }

			self.opts.tempstr = document.getElementById("ssTemp");
			self.opts.humstr = document.getElementById("ssHum");
			self.opts.visistr = document.getElementById("ssVisi");
			self.opts.windstr = document.getElementById("ssWind");
			self.opts.windirstr = document.getElementById("ssWindir");
			self.opts.msgstr = document.getElementById("ssMsg");
			self.opts.conditionstr = document.getElementById("ssCond");
			self.opts.locationstr = document.getElementById("ssLoc");
			self.opts.location2str = document.getElementById("ssLoc2");
						
			weather(self);
			// Refresh every 5 minutes.
			self.interval = setInterval(function() { weather(self) }, 300000);
        });
    };

    self.hide = function () {
        stopInterval();
		const elem = document.querySelector('.weatherbotScreenSaver');
		if (elem) {
            return new Promise((resolve) => {
				elem.parentNode.removeChild(elem);
				resolve();
            });
        }
        return Promise.resolve();
    };
}