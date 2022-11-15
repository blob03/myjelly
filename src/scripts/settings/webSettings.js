import DefaultConfig from '../../config.json';

let data;
const urlResolver = document.createElement('a');

// `fetch` with `file:` support
// Recent browsers seem to support `file` protocol under some conditions.
// Based on https://github.com/github/fetch/pull/92#issuecomment-174730593
//          https://github.com/github/fetch/pull/92#issuecomment-512187452
async function fetchLocal(url, options) {
    urlResolver.href = url;

    const requestURL = urlResolver.href;

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest;

        xhr.onload = () => {
            // `file` protocol has invalid OK status
            let status = xhr.status;
            if (requestURL.startsWith('file:') && status === 0) {
                status = 200;
            }

            /* eslint-disable-next-line compat/compat */
            resolve(new Response(xhr.responseText, {status: status}));
        };

        xhr.onerror = () => {
            reject(new TypeError('Local request failed'));
        };

        xhr.open('GET', url);

        if (options && options.cache) {
            xhr.setRequestHeader('Cache-Control', options.cache);
        }

        xhr.send(null);
    });
}

async function getConfig() {
    if (data) return Promise.resolve(data);
    try {
        const response = await fetchLocal('config.json', {
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error('network response was not ok');
        }

        data = await response.json();

        return data;
    } catch (error) {
        console.warn('failed to fetch the web config file:', error);
        data = DefaultConfig;
        return data;
    }
}

export function getIncludeCorsCredentials() {
    return getConfig()
        .then(config => !!config.includeCorsCredentials)
        .catch(error => {
            console.log('cannot get web config:', error);
            return false;
        });
}

export function getMultiServer() {
    return getConfig().then(config => {
        return !!config.multiserver;
    }).catch(error => {
        console.log('cannot get web config:', error);
        return false;
    });
}

export function getServers() {
    return getConfig().then(config => {
        return config.servers || [];
    }).catch(error => {
        console.log('cannot get web config:', error);
        return [];
    });
}

const baseDefaultTheme = {
    'name': 'Dark',
    'id': 'dark',
    'default': true
};

const baseDefaultPreset = {
    'name': 'Neon pink',
    'id': 'Neonpink',
    'default': true
};

let internalDefaultTheme = baseDefaultTheme;
let internalDefaultPreset = baseDefaultPreset;

const checkDefaultTheme = (themes) => {
    if (themes) {
        const defaultTheme = themes.find((theme) => theme.default);

        if (defaultTheme) {
            internalDefaultTheme = defaultTheme;
            return;
        }
    }

    internalDefaultTheme = baseDefaultTheme;
};

const checkDefaultPreset = (presets) => {
    if (presets) {
        const defaultPreset = presets.find((preset) => preset.default);

        if (defaultPreset) {
            internalDefaultPreset = defaultPreset;
            return;
        }
    }

    internalDefaultPreset = baseDefaultPreset;
};

export function getThemes() {
    return getConfig().then(config => {
        if (!Array.isArray(config.themes)) {
            console.error('web config is invalid, missing themes:', config);
        }
        const themes = Array.isArray(config.themes) ? config.themes : DefaultConfig.themes;
        checkDefaultTheme(themes);
        return themes;
    }).catch(error => {
        console.log('cannot get web config:', error);
        checkDefaultTheme();
        return DefaultConfig.themes;
    });
}

export function getPresets() {
    return getConfig().then(config => {
        if (!Array.isArray(config.presets)) {
            console.error('web config is invalid, missing presets:', config);
        }
        const presets = Array.isArray(config.presets) ? config.presets : DefaultConfig.presets;
        checkDefaultPreset(presets);
        return presets;
    }).catch(error => {
        console.log('cannot get web config:', error);
        checkDefaultPreset();
        return DefaultConfig.presets;
    });
}

export function loadUserPresets(templateName) {
	if (!templateName)
		return undefined;
	
	if (DefaultConfig?.userPresets)
		return DefaultConfig.userPresets[templateName];
	else {
		console.error('Web config file is invalid, missing user configuration:', config);
		return undefined;
	}
}

export function listUserPresets() {
	let list = [];
	Object.keys(DefaultConfig.userPresets).forEach( x => {list.push(x)} );
	return list;
}

export const getDefaultTheme = () => internalDefaultTheme;

export const getDefaultPreset = () => internalDefaultPreset;

export function getMenuLinks() {
    return getConfig().then(config => {
        if (!config.menuLinks) {
            console.error('web config is invalid, missing menuLinks:', config);
        }
        return config.menuLinks || [];
    }).catch(error => {
        console.log('cannot get web config:', error);
        return [];
    });
}

export function getPlugins() {
    return getConfig().then(config => {
        if (!config.plugins) {
            console.error('web config is invalid, missing plugins:', config);
        }
        return config.plugins || DefaultConfig.plugins;
    }).catch(error => {
        console.log('cannot get web config:', error);
        return DefaultConfig.plugins;
    });
}
