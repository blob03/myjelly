import * as userSettings from './settings/userSettings';
import globalize from './globalize';

export function getSavedQueryKey(modifier) {
    return window.location.href.split('#')[0] + (modifier || '');
}

export function loadSavedQueryValues(key, query) {
    let values = userSettings.get(key);

    if (values) {
        values = JSON.parse(values);
        return Object.assign(query, values);
    }

    return query;
}

export function saveQueryValues(key, query) {
    const values = {};

    if (query.SortBy) {
        values.SortBy = query.SortBy;
    }

    if (query.SortOrder) {
        values.SortOrder = query.SortOrder;
    }

    userSettings.set(key, JSON.stringify(values));
}

export function saveViewSetting (key, value) {
    userSettings.set(key + '-_view', value);
}

export function getSavedView (key) {
    return userSettings.get(key + '-_view');
}

export function showLayoutMenu (button, currentLayout, views) {
    let dispatchEvent = true;

    if (!views) {
        dispatchEvent = false;
        views = button.getAttribute('data-layouts');
        views = views ? views.split(',') : ['List', 'Poster', 'PosterCard', 'Thumb', 'ThumbCard'];
    }

    const menuItems = views.map(function (v) {
        return {
            name: globalize.translate(v),
            id: v,
            selected: currentLayout == v
        };
    });

    import('../components/actionSheet/actionSheet').then(({default: actionsheet}) => {
        actionsheet.show({
            items: menuItems,
            positionTo: button,
            callback: function (id) {
                button.dispatchEvent(new CustomEvent('layoutchange', {
                    detail: {
                        viewStyle: id
                    },
                    bubbles: true,
                    cancelable: false
                }));

                if (!dispatchEvent) {
                    if (window.$) {
                        $(button).trigger('layoutchange', [id]);
                    }
                }
            }
        });
    });
}

export function getQueryPagingHtml (options) {
    const startIndex = parseInt(options.startIndex, 10);
    const limit = parseInt(options.limit, 10);
    const totalRecordCount = parseInt(options.totalRecordCount, 10);
    let html = '';
	
    const recordsEnd = Math.min(startIndex + limit, totalRecordCount);
    const showControls = limit < totalRecordCount;

    html += '<div class="listPaging">';

    if (showControls) {
        html += '<span style="vertical-align:middle;">';
        html += globalize.translate('ListPaging', (totalRecordCount ? startIndex + 1 : 0), recordsEnd, totalRecordCount);
        html += '</span>';
    }
 
    if (showControls || options.viewButton || options.filterButton || options.sortButton || options.addLayoutButton) {
        html += '<div style="display:inline-block;">';

        if (showControls) {
            html += '<button is="paper-icon-button-light" class="btnPreviousPage autoSize" ' + (startIndex ? '' : 'disabled') + '><span class="material-icons arrow_back"></span></button>';
            html += '<button is="paper-icon-button-light" class="btnNextPage autoSize" ' + (startIndex + limit >= totalRecordCount ? 'disabled' : '') + '><span class="material-icons arrow_forward"></span></button>';
        }

        if (options.addLayoutButton) {
            html += '<button is="paper-icon-button-light" title="' + globalize.translate('ButtonSelectView') + '" class="btnChangeLayout autoSize" data-layouts="' + (options.layouts || '') + '" onclick="LibraryBrowser.showLayoutMenu(this, \'' + (options.currentLayout || '') + '\');"><span class="material-icons view_comfy"></span></button>';
        }

        if (options.sortButton) {
            html += '<button is="paper-icon-button-light" class="btnSort autoSize" title="' + globalize.translate('Sort') + '"><span class="material-icons sort_by_alpha"></span></button>';
        }

        if (options.filterButton) {
            html += '<button is="paper-icon-button-light" class="btnFilter autoSize" title="' + globalize.translate('Filter') + '"><span class="material-icons filter_list"></span></button>';
        }

        html += '</div>';
    }

    return html += '</div>';
}

export function showSortMenu (options) {
    Promise.all([
        import('../components/dialogHelper/dialogHelper'),
        import('../elements/emby-radio/emby-radio')
    ]).then(([{default: dialogHelper}]) => {
        function onSortByChange() {
            const newValue = this.value;

            if (this.checked) {
                const changed = options.query.SortBy != newValue;
                options.query.SortBy = newValue.replace('_', ',');
                options.query.StartIndex = 0;

                if (options.callback && changed) {
                    options.callback();
                }
            }
        }

        function onSortOrderChange() {
            const newValue = this.value;

            if (this.checked) {
                const changed = options.query.SortOrder != newValue;
                options.query.SortOrder = newValue;
                options.query.StartIndex = 0;

                if (options.callback && changed) {
                    options.callback();
                }
            }
        }

        const dlg = dialogHelper.createDialog({
            removeOnClose: true,
            modal: false,
            entryAnimationDuration: 160,
            exitAnimationDuration: 200
        });
        dlg.classList.add('ui-body-a');
        dlg.classList.add('background-theme-a');
        dlg.classList.add('formDialog');
        let html = '';
        html += '<div style="margin:0;padding:1.25em 1.5em 1.5em;">';
        html += '<h2 style="margin:0 0 .5em;">';
        html += globalize.translate('HeaderSortBy');
        html += '</h2>';
        let i;
        let length;
        let isChecked;
        html += '<div>';
        for (i = 0, length = options.items.length; i < length; i++) {
            const option = options.items[i];
            const radioValue = option.id.replace(',', '_');
            isChecked = (options.query.SortBy || '').replace(',', '_') == radioValue ? ' checked' : '';
            html += '<label class="radio-label-block"><input type="radio" is="emby-radio" name="SortBy" data-id="' + option.id + '" value="' + radioValue + '" class="menuSortBy" ' + isChecked + ' /><span>' + option.name + '</span></label>';
        }

        html += '</div>';
        html += '<h2 style="margin: 1em 0 .5em;">';
        html += globalize.translate('HeaderSortOrder');
        html += '</h2>';
        html += '<div>';
        isChecked = options.query.SortOrder == 'Ascending' ? ' checked' : '';
        html += '<label class="radio-label-block"><input type="radio" is="emby-radio" name="SortOrder" value="Ascending" class="menuSortOrder" ' + isChecked + ' /><span>' + globalize.translate('Ascending') + '</span></label>';
        isChecked = options.query.SortOrder == 'Descending' ? ' checked' : '';
        html += '<label class="radio-label-block"><input type="radio" is="emby-radio" name="SortOrder" value="Descending" class="menuSortOrder" ' + isChecked + ' /><span>' + globalize.translate('Descending') + '</span></label>';
        html += '</div>';
        html += '</div>';
        dlg.innerHTML = html;
        dialogHelper.open(dlg);
        const sortBys = dlg.querySelectorAll('.menuSortBy');

        for (i = 0, length = sortBys.length; i < length; i++) {
            sortBys[i].addEventListener('change', onSortByChange);
        }

        const sortOrders = dlg.querySelectorAll('.menuSortOrder');

        for (i = 0, length = sortOrders.length; i < length; i++) {
            sortOrders[i].addEventListener('change', onSortOrderChange);
        }
    });
}

const libraryBrowser = {
    getSavedQueryKey,
    loadSavedQueryValues,
    saveQueryValues,
    saveViewSetting,
    getSavedView,
    showLayoutMenu,
    getQueryPagingHtml,
    showSortMenu
};

window.LibraryBrowser = libraryBrowser;

export default libraryBrowser;
