import SubtitleSettings from '../../../components/subtitlesettings/subtitlesettings';
import * as userSettings from '../../../scripts/settings/userSettings';
import autoFocuser from '../../../components/autoFocuser';

/* eslint-disable indent */

    // Shortcuts
    const UserSettings = userSettings.UserSettings;

    export default function (view, params) {
        let subtitleSettingsInstance;
		const userId = params.userId || ApiClient.getCurrentUserId();
        const currentSettings = userId === ApiClient.getCurrentUserId() ? userSettings : new UserSettings();

        view.addEventListener('viewshow', function () {
            if (!subtitleSettingsInstance) {
                subtitleSettingsInstance = new SubtitleSettings({
                    serverId: ApiClient.serverId(),
					apiClient: ApiClient,
                    userId: userId,
                    element: view.querySelector('.settingsContainer'),
                    userSettings: currentSettings,
                    enableSaveButton: true,
                    enableSaveConfirmation: true,
                    autoFocus: autoFocuser.isEnabled()
                });
            }
        });

        view.addEventListener('viewdestroy', function () {
            if (subtitleSettingsInstance) {
                subtitleSettingsInstance.destroy();
                subtitleSettingsInstance = null;
            }
        });
    }

/* eslint-enable indent */
