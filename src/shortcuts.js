(()=>{
    zoteroRoam.shortcuts = {
        actions: {
            closeSearchPanel: {
                defaultShortcut: {'Escape': true},
                execute(){
                    if (zoteroRoam.interface.search.visible){
                        zoteroRoam.interface.toggleSearchOverlay("hide");
                    }
                }
            },
            toggleSearchPanel: {
                defaultShortcut: {altKey: true, 'q': true},
                execute(){
                    let cmd = zoteroRoam.interface.search.visible ? "hide" : "show";
                    zoteroRoam.interface.toggleSearchOverlay(cmd);
                }
            },
            toggleQuickCopy: {
                defaultShortcut: [],
                execute(){
                    let newState = (zoteroRoam.interface.search.quickCopyToggle.checked) ? false : true;
                    zoteroRoam.interface.search.quickCopyToggle.checked = newState;
                }
            },
            importMetadata: {
                defaultShortcut: [],
                execute(){
                    let addItemMetadataButton = document.querySelector("button.item-add-metadata");
                    if(addItemMetadataButton !== null){
                        addItemMetadataButton.click();
                    }
                }
            }
        },

        setup(){
            // This will first check user input & generate a list of templates based on that + defaults
            // Then create new Shortcut objects as needed, and store them in config.shortcuts
            let templates = {};
            for(action in zoteroRoam.shortcuts.actions){
                let { [action] : temp = action.defaultShortcut } = zoteroRoam.config.userSettings.shortcuts;
                templates[action] = temp;
            }
            let shortcutObjects = [];
            for(k in templates){
                if(templates[k].constructor === Object){ 
                    shortcutObjects.push({ action: k, template: templates[k]});
                } else if(templates[k].constructor === Array){
                    templates[k].forEach(tem => {
                        shortcutObjects.push({ action: k, template: tem});
                    })
                }
            }
            shortcutObjects.forEach(obj => {
                zoteroRoam.config.shortcuts.push(new zoteroRoam.Shortcut(obj));
            })
        },

        verify(e){
            let keyName = e.key;
            let keyPressed = (e.type == "keydown") ? true : false;
            let specialKeys = ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'];
            // Update all the watchers
            zoteroRoam.config.shortcuts.forEach(s => {
                // Update status of special keys
                specialKeys.forEach(k => { s.watcher[`${k}`] = e[`${k}`] });
                // If the key is part of the shortcut template, update its real-time status (true = pressed, false = not pressed)
                if(s.template.hasOwnProperty(keyName)){ s.watcher[`${keyName}`] = keyPressed };
            });
            // Once all the watchers have been updated, compare the watchers against the templates & decide whether an action should be triggered
            // Note that if two shortcuts are somehow triggered in the same combination of keys, they'll be processed in order of declaration
            zoteroRoam.config.shortcuts.forEach(s => {
                if(JSON.stringify(s.watcher) === JSON.stringify(s.template)){
                    zoteroRoam.shortcuts.actions[`${s.action}`].execute();
                }
            });
        }
    }
})