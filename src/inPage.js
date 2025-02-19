;(()=>{
    zoteroRoam.inPage = {
        /** Rigs ref-citekey elements that are in the dataset with a listener for context menu */
        addContextMenuListener() {
            var refCitekeys = document.querySelectorAll(".ref-citekey");
            for (var i = 0; i < refCitekeys.length; i++) {
                var ref = refCitekeys[i];
        
                // Handle case where item hasn't been checked against data yet
                if(!ref.dataset.zoteroBib) {
                    if(zoteroRoam.data.items.find(libItem => libItem.key == ref.dataset.linkTitle.replace("@", ""))){
                        ref.dataset.zoteroBib = "inLibrary";
                    } else {
                        ref.dataset.zoteroBib = "notFound";
                    }
                }
        
                // Only add a listener for context menu if the item has been found in the library
                if (ref.dataset.zoteroBib == "inLibrary") {
                    // Robust regardless of brackets
                    ref.querySelector('.rm-page-ref').addEventListener("contextmenu", zoteroRoam.interface.popContextMenu);
                }
            }
        },

        /** Checks references for new citekeys, then checks data for the citekeys and adds a listener to them
         * @param {boolean} update - Should old references be re-checked ? */
        checkReferences(update = false){
            let refCitekeyFound = false;
            setTimeout(function(){
                do {
                    let refs = document.getElementsByClassName("rm-page-ref");
                    refCitekeyFound = zoteroRoam.inPage.identifyCitekeys(refs);
                } while (refCitekeyFound == true);
            }, 300);
            zoteroRoam.inPage.checkCitekeys(update = update);
            zoteroRoam.inPage.addContextMenuListener();
        },

        /** Scans page references to find new citekeys (do not have the 'ref-citekey' custom class)
         * @param {Element[]} refs = The Array of page references to be scanned
         * @returns {boolean} Was there a new citekey found ? */
        identifyCitekeys(refs){
            let matched = false;
            for (i = 0; i < refs.length; i++) {
                let parentDiv = refs[i].parentElement;
                if (typeof (parentDiv.dataset.linkTitle) === 'undefined') {
                    continue;
                } else {
                    // Only do this for page refs for now, we'll see about tags later or not at all
                    if (parentDiv.dataset.linkTitle.startsWith("@")) {
                        if (parentDiv.classList.contains("ref-citekey")) {
                            matched = false;
                        } else {
                            parentDiv.classList.add("ref-citekey");
                            matched = true;
                        }
                    }
                }
            }
            return matched;
        },
        
        /** Verifies if citekeys in the current view are present in the loaded dataset
         * @param {boolean} update - Should the extension also verify citekeys that had been checked previously ? */
        checkCitekeys(update = false){
            let refCitekeys = document.querySelectorAll('.ref-citekey');
            let newMatches = 0;
            let newUnmatches = 0;

            refCitekeys.forEach(ref => {
                // References that have a data-zotero-bib attribute have already been checked -- use param `update` to see if we should check again
                if (ref.dataset.zoteroBib) {
                    // If `update` is set to 'false', we don't bother checking anything & continue
                    if(update == true){
                        // If `update` is set to 'true', if the item was previously "notFound", check it against the dataset again
                        // If the item was previously "inLibrary", we continue (it's implied by reaching the end of the if statement)
                        if(ref.dataset.zoteroBib == "notFound"){
                            if (zoteroRoam.data.items.find(item => item.key == ref.dataset.linkTitle.replace("@", ""))) {
                                ref.dataset.zoteroBib = "inLibrary";
                                newMatches = newMatches + 1;
                            } else {
                                // Otherwise count it as unmatch
                                newUnmatches = newUnmatches + 1;
                            }
                        }
                    }
                } else {
                    // For items that haven't been checked yet, look for their citekey in the dataset
                    ref.dataset.zoteroBib = (zoteroRoam.data.items.find(item => item.key == ref.dataset.linkTitle.replace("@", ""))) ? "inLibrary" : "notFound";
                    switch(ref.dataset.zoteroBib){
                        case "inLibrary":
                            newMatches += 1;
                            break;
                        case "notFound":
                            newUnmatches += 1;
                    }
                }
            })
            if(newMatches > 0 | newUnmatches > 0){
                console.log(`New matched citekeys: ${newMatches}, New unmatched citekeys: ${newUnmatches}`);
            }
        },

        /** Converts a Roam page reference to a citation alias
         * @param {Element} el - The DOM Element of the page reference */
        convertToCitekey(el){
            let libItem = zoteroRoam.data.items.find(item => item.key == el.innerText.slice(1));
            let currentBlock = el.closest('.roam-block');
            // Find the UID of the ref-citekey's block
            let blockUID = currentBlock.id.slice(-9);
            // Find the index of the ref-citekey within the block
            let refIndex = Array.from(currentBlock.querySelectorAll('.ref-citekey')).findIndex(ref => ref == el.parentNode);

            let blockQuery = window.roamAlphaAPI.q('[:find ?text :in $ ?uid :where[?b :block/uid ?uid][?b :block/string ?text]]', blockUID)[0];
            if(blockQuery.length > 0){
                let contents = blockQuery[0];
                let replacementRegex = new RegExp(`(.*?(?:\\[\\[@.+?\\]\\].*?){${refIndex}})(\\[\\[@.+?\\]\\])(.*)`, 'g');
                let newContents = contents.replace(replacementRegex, (match, pre, refcitekey, post) => `${pre}${zoteroRoam.utils.formatItemReference(libItem, 'citation')}${post}`);
                window.roamAlphaAPI.updateBlock({'block': {'uid': blockUID, 'string': newContents}})
            }

        },

        /** Generates a page menu for each page currently in view
         * @param {number} wait - The duration of the delay to wait before attempting to generate the menu */
        async addPageMenus(wait = 100){
            zoteroRoam.utils.sleep(wait);
            let openPages = Array.from(document.querySelectorAll("h1.rm-title-display"));
            for(const page of openPages) {
                if(page.parentElement.querySelector('.zotero-roam-page-div') || page.parentElement.querySelector('.zotero-roam-page-related')){
                    continue;
                }
                let title = page.querySelector('span') ? page.querySelector('span').innerText : page.innerText;
                if(!zoteroRoam.config.params.pageMenu.trigger(title)){
                    continue;
                }
                // Case 1 (ref-citekey) = make page menu
                if(title.startsWith("@")){
                    let itemCitekey = title.slice(1);
                    let itemInLib = zoteroRoam.data.items.find(it => it.key == itemCitekey);
                    // If the item is in the library
                    if(typeof(itemInLib) !== 'undefined'){
                        zoteroRoam.inPage.renderCitekeyMenu(item = itemInLib, title = title, elem = page);
                    } else {
                        try{
                            page.parentElement.querySelector(".zotero-roam-page-div").remove();
                        } catch(e){};
                    }
                } else if(title.match(/(.+) ([0-9]+).{2}, ([0-9]{4})/g)){
                // Case 2 (DNP) - display items added on that date, if any 
                    let addedOn = zoteroRoam.utils.findSameDay(zoteroRoam.utils.readDNP(title));
                    if(addedOn.length > 0){
                        let itemKeys = addedOn.map(i => i.key);
                        let listDiv = document.createElement('div');
                        listDiv.classList.add('zotero-roam-page-related');
                        listDiv.classList.add('bp3-button-group');
                        listDiv.classList.add('bp3-minimal');
                        listDiv.classList.add('bp3-align-left');
                        listDiv.classList.add('bp3-vertical');
                        listDiv.innerHTML = zoteroRoam.utils.renderBP3Button_group(string = `${addedOn.length} item${addedOn.length > 1 ? "s" : ""} added`, {icon: "calendar", buttonClass: "zotero-roam-page-added-on", buttonAttribute: `data-title="${title}" data-keys=${JSON.stringify(itemKeys)}`});
                        page.insertAdjacentElement('afterend', listDiv);
                    }
                } else {
                // Case 3 (all other pages) - display items with matching tags + abstracts
                    let taggedWith = zoteroRoam.data.items.filter(i => i.data.tags && i.data.tags.map(t => t.tag).includes(title));
                    let abstractMentions = zoteroRoam.data.items.filter(i => i.data.abstractNote && i.data.abstractNote.includes(title));
                    if(taggedWith.length > 0 || abstractMentions.length > 0){
                        let listDiv = document.createElement('div');
                        listDiv.classList.add('zotero-roam-page-related');
                        listDiv.classList.add('bp3-button-group');
                        listDiv.classList.add('bp3-minimal');
                        listDiv.classList.add('bp3-align-left');
                        listDiv.classList.add('bp3-vertical');
                        let tagBtn = "";
                        if(taggedWith.length > 0){
                            let itemKeys = taggedWith.map(i => i.key);
                            tagBtn = zoteroRoam.utils.renderBP3Button_group(`${taggedWith.length} tagged item${taggedWith.length > 1 ? "s" : ""}`, {icon: 'manual', buttonClass: "zotero-roam-page-tagged-with", buttonAttribute: `data-title="${title}" data-keys=${JSON.stringify(itemKeys)}`});
                        }
                        let abstractBtn = "";
                        if(abstractMentions.length > 0){
                            let itemKeys = abstractMentions.map(i => i.key);
                            abstractBtn = zoteroRoam.utils.renderBP3Button_group(`${abstractMentions.length} abstract${abstractMentions.length > 1 ? "s" : ""}`, {icon: 'manually-entered-data', buttonClass: "zotero-roam-page-abstract-mentions", buttonAttribute: `data-title="${title}" data-keys=${JSON.stringify(itemKeys)}`});
                        }
                        listDiv.innerHTML = `
                        ${tagBtn}
                        ${abstractBtn}
                        `;
                        page.insertAdjacentElement('afterend', listDiv);
                    }
                }
            };
        },

        /** Generates code for a Scite badge
         * @param {string} doi - The DOI for which the badge should be made
         * @param {object} settings - An object containing badge settings 
         * @param {string} settings.layout - Should the badge be horizontal or vertical ?
         * @param {string} settings.showZero - Should the badge include categories that contain no citing paper ?
         * @param {string} settings.showLabels - Should the badge display category labels ?
         * @param {string} settings.tooltip - Where should the tooltip be displayed ?
         * @returns {string} The HTML for the badge */
        makeSciteBadge(doi, {layout = "horizontal", showZero = "true", showLabels = "false", tooltip = "bottom"} = {}){
            let sciteBadge = document.createElement("div");
            sciteBadge.classList.add("scite-badge");
            sciteBadge.setAttribute("data-doi", doi);
            sciteBadge.setAttribute("data-layout", layout);
            sciteBadge.setAttribute("data-show-zero", showZero);
            sciteBadge.setAttribute("data-show-labels", showLabels);
            sciteBadge.setAttribute("data-tooltip-placement", tooltip);

            return sciteBadge;
        },

        /** Event delegation for clicks within a page menu
         * @param {Element} target - The DOM Element where the click event happened  */
        async handleClicks(target){
            if(target.closest('.zotero-roam-page-div')){
                let pageDiv = target.closest('.zotero-roam-page-div');
                let title = pageDiv.dataset.title;
                let uid = pageDiv.dataset.uid;
                let btn = target.closest('button');
                if(btn){
                    if(btn.classList.contains('zotero-roam-page-menu-add-metadata')){
                        console.log(`Importing metadata to ${title} (${uid})...`);
                        zoteroRoam.handlers.importItemMetadata(title, uid = uid, {popup: true});
                    } else if(btn.classList.contains('zotero-roam-page-menu-import-notes')){
                        console.log(`Adding notes to ${title} (${uid})...`);
                        zoteroRoam.handlers.addItemNotes(title = title, uid = uid);
                    } else if(btn.classList.contains('zotero-roam-page-menu-view-item-info')){
                        zoteroRoam.interface.renderItemInPanel(citekey = title);
                    } else if(btn.classList.contains('zotero-roam-page-menu-backlinks-button')){
                        // Change caret class & show the backlinks list
                        let caretEl = btn.querySelector(".bp3-icon-caret-down");
                        let backlinksList = btn.parentElement.querySelector(".zotero-roam-page-menu-backlinks-list");

                        if(Array.from(caretEl.classList).includes("rm-caret-closed") && backlinksList){
                            caretEl.classList.replace("rm-caret-closed", "rm-caret-open");
                            backlinksList.style.display = "flex";
                        } else if(Array.from(caretEl.classList).includes("rm-caret-open")){
                            caretEl.classList.replace("rm-caret-open", "rm-caret-closed");
                            backlinksList.style.display = "none";
                        }
                    } else if(btn.classList.contains('zotero-roam-page-menu-backlink-open-sidebar')){
                        zoteroRoam.utils.addToSidebar(uid = btn.dataset.uid);
                    } else if(btn.classList.contains('zotero-roam-page-menu-backlink-add-sidebar')){
                        let elUID = roamAlphaAPI.util.generateUID();
                        roamAlphaAPI.createPage({'page': {'title': btn.dataset.title, 'uid': elUID}});
                        await zoteroRoam.handlers.importItemMetadata(title = btn.dataset.title, uid = elUID, {popup: false});
                        zoteroRoam.utils.addToSidebar(uid = elUID);
                    } else if(btn.classList.contains('zotero-roam-page-menu-backlinks-total')){
                        let doi = btn.getAttribute("data-doi");
                        let citekey = btn.getAttribute("data-citekey");
                        zoteroRoam.interface.popCitationsOverlay(doi, citekey, type = "citations");
                    } else if(btn.classList.contains('zotero-roam-page-menu-references-total')){
                        let doi = btn.getAttribute("data-doi");
                        let citekey = btn.getAttribute("data-citekey");
                        zoteroRoam.interface.popCitationsOverlay(doi, citekey, type = "references");
                    }
                }
            } else if(target.closest('.zotero-roam-page-related')){
                let btn = target.closest('button');
                if(btn){
                    let title = btn.dataset.title;
                    let keys = JSON.parse(btn.dataset.keys);
                    if(btn.classList.contains("zotero-roam-page-added-on")){
                        zoteroRoam.interface.popRelatedDialog(title, keys, type = "added-on");
                    } else if(btn.classList.contains("zotero-roam-page-tagged-with")){
                        zoteroRoam.interface.popRelatedDialog(title, keys, type = "tagged-with");
                    } else if(btn.classList.contains("zotero-roam-page-abstract-mentions")){
                        zoteroRoam.interface.popRelatedDialog(title, keys, type = "abstract-mention");
                    }
                }
            } else if(target.closest('.zotero-roam-explo-import')){
                let rBlock = target.closest('.rm-block');
                let links = rBlock.querySelectorAll('.rm-block a:not(.rm-alias--page):not(.rm-alias--block)');
                let urlList = Array.from(links).map(l => l.href);
                zoteroRoam.webImport.currentBlock = rBlock.querySelector('.rm-block-main .roam-block');

                // Open the dialog before harvesting the metadata, show loading state
                let overlay = document.querySelector('.zotero-roam-auxiliary-overlay');
                overlay.querySelector('.main-panel .header-left').innerHTML = `${zoteroRoam.utils.renderBP3Spinner()}`;
                overlay.querySelector('.main-panel .rendered-div').innerHTML = ``;
                overlay.querySelector('.bp3-dialog').setAttribute('side-panel', 'visible');
                zoteroRoam.interface.triggerImport(type = "weblinks");
                overlay.style.display = "block";
                overlay.setAttribute("overlay-visible", "true");

                // Request metadata
                let citoidList = [];
                urlList.forEach(url => {
                    citoidList.push(zoteroRoam.handlers.requestCitoid(query = url));
                });
                let harvest = await Promise.all(citoidList);
                zoteroRoam.webImport.activeImport = {
                    items: null
                }
                let successes = harvest.filter(cit => cit.success == true);
                zoteroRoam.webImport.activeImport.harvest = successes;
                if(successes.length > 0){
                    zoteroRoam.interface.fillWebImportDialog(successes);
                } else {
                    overlay.querySelector('.main-panel .header-left').innerHTML = `<p>No data successfully retrieved</p>`;
                }
            }
        },

        /** Makes a page menu for a ref-citekey header
         * @fires zotero-roam:menu-ready
         * @param {object} item - The Zotero item for which to make the menu 
         * @param {string} title - The title of the Roam page 
         * @param {Element} elem - The DOM Element of the h1.rm-title-display for which the menu is being added 
         */
        async renderCitekeyMenu(item, title, elem){
            let itemCitekey = title.slice(1);
            let itemDOI = zoteroRoam.utils.parseDOI(item.data.DOI) || "";
            let pageInGraph = zoteroRoam.utils.lookForPage(title);
            let itemChildren = zoteroRoam.formatting.getItemChildren(item, { pdf_as: "raw", notes_as: "raw" });
            // List of default elements to include
            let menu_defaults = zoteroRoam.config.params.pageMenu.defaults;
            // ----
            // Div wrapper
            let pageDiv = elem.parentElement.querySelector('.zotero-roam-page-div');
            if(pageDiv == null){
                pageDiv = document.createElement("div");
                pageDiv.classList.add("zotero-roam-page-div");
                pageDiv.setAttribute("data-uid", pageInGraph.uid);
                pageDiv.setAttribute("data-title", title);
                pageDiv.innerHTML = !itemDOI ? `` :`
                <span class="zotero-roam-page-doi" data-doi="${itemDOI}">
                <a href="https://doi.org/${itemDOI}" class="bp3-text-muted" target="_blank">${itemDOI}</a>
                </span>
                `;
                elem.insertAdjacentElement('afterend', pageDiv);
        
                // ---
                // Page menu
                let menuDiv = elem.parentElement.querySelector('.zotero-roam-page-menu');
                if(menuDiv == null){
                    menuDiv = document.createElement("div");
                    menuDiv.classList.add("zotero-roam-page-menu");
                    menuDiv.classList.add("bp3-card");
                    if(zoteroRoam.config.params.theme){ menuDiv.classList.add(zoteroRoam.config.params.theme) };
                    pageDiv.appendChild(menuDiv);
                }
        
                // Check contents of the menu settings, and create elements accordingly
                let addMetadata_element = !menu_defaults.includes("addMetadata") ? `` : zoteroRoam.utils.renderBP3Button_group(string = "Add metadata", {buttonClass: "bp3-minimal zotero-roam-page-menu-add-metadata", icon: "add"});
                let importNotes_element = !menu_defaults.includes("importNotes") || !itemChildren.notes ? `` : zoteroRoam.utils.renderBP3Button_group(string = "Import notes", {buttonClass: "bp3-minimal zotero-roam-page-menu-import-notes", icon: "comment"});
                let viewItemInfo_element = !menu_defaults.includes("viewItemInfo") ? `` : zoteroRoam.utils.renderBP3Button_group(string = "View item information", {buttonClass: "bp3-minimal zotero-roam-page-menu-view-item-info", icon: "info-sign"});
                let openZoteroLocal_element = !menu_defaults.includes("openZoteroLocal") ? `` : zoteroRoam.utils.renderBP3Button_link(string = "Open in Zotero", {linkClass: "bp3-minimal zotero-roam-page-menu-open-zotero-local", target: zoteroRoam.formatting.getLocalLink(item, {format: "target"}), linkAttribute: `target="_blank"`, icon: "application"});
                let openZoteroWeb_element = !menu_defaults.includes("openZoteroWeb") ? `` : zoteroRoam.utils.renderBP3Button_link(string = "Open in Zotero [Web library]", {linkClass: "bp3-minimal zotero-roam-page-menu-open-zotero-web", target: zoteroRoam.formatting.getWebLink(item, {format: "target"}), linkAttribute: `target="_blank"`, icon: "cloud"});
        
                // PDF links
                let pdfLinks_element = !menu_defaults.includes("pdfLinks") || !itemChildren.pdfItems ? `` : itemChildren.pdfItems.map(item => {
                        let libLoc = item.library.type == "group" ? `groups/${item.library.id}` : `library`;
                        let pdfHref = (["linked_file", "imported_file", "imported_url"].includes(item.data.linkMode)) ? `zotero://open-pdf/${libLoc}/items/${item.data.key}` : item.data.url;
                        let pdfTitle = item.data.filename || item.data.title;
                        return zoteroRoam.utils.renderBP3Button_link(string = pdfTitle, {linkClass: "bp3-minimal zotero-roam-page-menu-pdf-link", icon: "paperclip", target: pdfHref, linkAttribute: `target="_blank"` });
                }).join("");
        
                // Web records
                let records_list = [];
                if(menu_defaults.includes("connectedPapers")){ records_list.push(zoteroRoam.utils.renderBP3Button_link(string = "Connected Papers", {icon: "layout", linkClass: "bp3-minimal bp3-intent-primary zotero-roam-page-menu-connected-papers", linkAttribute: `target="_blank"`, target: `https://www.connectedpapers.com/${(!item.data.DOI) ? "search?q=" + encodeURIComponent(item.data.title) : "api/redirect/doi/" + itemDOI}`})) }
                if(menu_defaults.includes("semanticScholar")){ records_list.push((!itemDOI) ? "" : zoteroRoam.utils.renderBP3Button_link(string = "Semantic Scholar", {icon: "bookmark", linkClass: "bp3-minimal bp3-intent-primary zotero-roam-page-menu-semantic-scholar", linkAttribute: `target="_blank"`, target: `https://api.semanticscholar.org/${itemDOI}`})) }
                if(menu_defaults.includes("googleScholar")){ records_list.push(zoteroRoam.utils.renderBP3Button_link(string = "Google Scholar", {icon: "learning", linkClass: "bp3-minimal bp3-intent-primary zotero-roam-page-menu-google-scholar", linkAttribute: `target="_blank"`, target: `https://scholar.google.com/scholar?q=${(!item.data.DOI) ? encodeURIComponent(item.data.title) : itemDOI}`})) }
        
                // Backlinks
                let backlinksLib = "";
                let citeObject = null;
                try{
                    if(menu_defaults.includes("citingPapers") && itemDOI){
                        citeObject = await zoteroRoam.handlers.getSemantic(itemDOI);
                        if(citeObject.data){
                            let citingDOIs = citeObject.citations.map(cit => zoteroRoam.utils.parseDOI(cit.doi)).filter(Boolean);
                            let citedDOIs = citeObject.references.map(ref => zoteroRoam.utils.parseDOI(ref.doi)).filter(Boolean);
                            let allDOIs = [...citingDOIs, ...citedDOIs];
                            if(allDOIs.length > 0){
                                let doisInLib = zoteroRoam.data.items.filter(it => zoteroRoam.utils.parseDOI(it.data.DOI));
                                let papersInLib = allDOIs.map(doi => doisInLib.find(it => zoteroRoam.utils.parseDOI(it.data.DOI) == doi)).filter(Boolean);
                                papersInLib.forEach((paper, index) => {
                                    if(citingDOIs.includes(paper.data.DOI)){
                                        papersInLib[index].type = "citing";
                                    } else {
                                        papersInLib[index].type = "cited";
                                    }
                                });
                                backlinksLib = "";
                                backlinksLib += zoteroRoam.utils.renderBP3Button_group(string = `${citeObject.references.length > 0 ? citeObject.references.length : "No"} references`, {buttonClass: "bp3-minimal bp3-intent-primary zotero-roam-page-menu-references-total", icon: "citation", buttonAttribute: `data-doi="${itemDOI}" data-citekey="${itemCitekey}" aria-label="Show available references" ${citedDOIs.length > 0 ? "" : "disabled aria-disabled='true'"}`});
                                backlinksLib += zoteroRoam.utils.renderBP3Button_group(string = `${citeObject.citations.length > 0 ? citeObject.citations.length : "No"} citing papers`, {buttonClass: "bp3-minimal bp3-intent-warning zotero-roam-page-menu-backlinks-total", icon: "chat", buttonAttribute: `data-doi="${itemDOI}" data-citekey="${itemCitekey}" aria-label="Show available citing papers" ${citingDOIs.length > 0 ? "" : "disabled aria-disabled='true'"}`});
                                backlinksLib += zoteroRoam.utils.renderBP3Button_group(string = `${papersInLib.length > 0 ? papersInLib.length : "No"} related library items`, {buttonClass: `${papersInLib.length > 0 ? "" : "bp3-disabled"} bp3-minimal zotero-roam-page-menu-backlinks-button`, icon: "caret-down bp3-icon-standard rm-caret rm-caret-closed", buttonAttribute: `aria-label="Show related items present in Zotero library" aria-controls="zr-backlinks-list-${itemCitekey}" ${papersInLib.length > 0 ? "" : "aria-disabled='true'"}`});
            
                                if(papersInLib.length > 0){
                                    backlinksLib += `
                                    <ul id="zr-backlinks-list-${itemCitekey}" class="zotero-roam-page-menu-backlinks-list bp3-list-unstyled" style="display:none;">
                                    ${zoteroRoam.inPage.renderBacklinksList_year(papersInLib, origin_year = item.meta.parsedDate ? new Date(item.meta.parsedDate).getUTCFullYear() : "")}
                                    </ul>
                                    `
                                }
                            }
                        }
                    }
                } catch(e){
                    console.log(`Citations rendering error : ${e}`);
                }
        
                menuDiv.innerHTML = `
                <div class="zotero-roam-page-menu-header">
                <div class="zotero-roam-page-menu-actions bp3-button-group">
                ${addMetadata_element}
                ${importNotes_element}
                ${viewItemInfo_element}
                ${openZoteroLocal_element}
                ${openZoteroWeb_element}
                ${pdfLinks_element}
                ${records_list.length == 0 ? "" : records_list.join("\n")}
                </div>
                </div>
                <div class="zotero-roam-page-menu-citations" ${itemDOI ? `data-doi="${itemDOI}"` : ""}>
                ${backlinksLib}
                </div>
                `;
        
                // ---
                // Badge from scite.ai
                if(menu_defaults.includes("sciteBadge")){
                    if(item.data.DOI && elem.parentElement.querySelector(".scite-badge") == null){
                        let sciteBadge = zoteroRoam.inPage.makeSciteBadge(doi = itemDOI);
                        elem.parentElement.querySelector(".zotero-roam-page-menu-header").appendChild(sciteBadge);
                        // Manual trigger to insert badges
                        window.__SCITE.insertBadges();
                    }
                }
        
                /**
                 * @event zoteroRoam:menu-ready
                 * @type {object}
                 * @property {string} title - The item's Roam page title
                 * @property {object} item - The item's Zotero data object
                 * @property {string} doi - The item's DOI
                 * @property {string} uid - The item's Roam page UID
                 * @property {object} children - The item's children
                 * @property {object} semantic - The item's citations data from Semantic Scholar
                 * @property {Element} div - The menu's HTML node
                 * @property {string} context - The context in which the menu was generated (main section or sidebar)
                 */
                 zoteroRoam.events.emit('menu-ready', {
                    title: title,
                    item: item,
                    doi: itemDOI,
                    uid: pageInGraph.uid,
                    children: itemChildren,
                    semantic: citeObject,
                    div: pageDiv,
                    context: pageDiv.closest('.roam-article') ? "main" : "sidebar"
                });
        
            }
        },

        renderCitekeyRefs(){
            let refCitekeys = document.querySelectorAll("span[data-link-title^='@']");
            for(i=0;i<refCitekeys.length;i++){
              let refCitekeyElement = refCitekeys[i];
              let linkElement = refCitekeyElement.getElementsByClassName('rm-page-ref')[0];
              let keyStatus = refCitekeyElement.getAttribute('data-zotero-bib');
              let citekey = refCitekeyElement.getAttribute('data-link-title').slice(1);
              
              if(keyStatus == "inLibrary"){
                let libItem = zoteroRoam.data.items.find(it => it.key == citekey);
                if(libItem){
                     linkElement.textContent = zoteroRoam.utils.formatItemReference(libItem, "inline"); 
                } else if(linkElement.textContent != '@' + citekey){
                      linkElement.textContent = '@' + citekey;  
                }
              } else if(linkElement.textContent != '@' + citekey){
                linkElement.textContent = '@' + citekey;
              }
            }
        },

        renderBacklinksItem_year(paper, type, uid = null){
            let accent_class = type == "reference" ? "zr-highlight" : "zr-highlight-2";
            let intent = type == "reference" ? "bp3-intent-primary" : "bp3-intent-warning";
            if(uid){
                return `
                <li class="related-item_listed" item-type="${type}" data-key="@${paper.key}" data-item-type="${paper.data.itemType}" data-item-year="${paper.meta.parsedDate ? new Date(paper.meta.parsedDate).getUTCFullYear() : ""}" in-graph="true">
                    <div class="related_year">${paper.meta.parsedDate ? new Date(paper.meta.parsedDate).getUTCFullYear() : ""}</div>
                    <div class="related_info">
                        <span class="zotero-roam-search-item-authors ${accent_class}">${paper.meta.creatorSummary || ""}</span><span class="zr-secondary">${paper.data.publicationTitle || paper.data.bookTitle || ""}</span>
                        <a class="zotero-roam-search-item-title" href="${window.location.hash.match(/#\/app\/([^\/]+)/g)[0]}/page/${uid}">
                            ${paper.data.title}
                        </a>
                    </div>
                    <div class="related_state">
                        ${zoteroRoam.utils.renderBP3Button_group(string = "", {buttonClass: `bp3-minimal zr-text-small ${intent} zotero-roam-page-menu-backlink-open-sidebar`, icon: "inheritance", buttonAttribute: `data-uid="${uid}" title="Open in sidebar" aria-label="Open @${paper.key} in the sidebar"`})}
                    </div>
                </li>`;
            } else {
                return `
                <li class="related-item_listed" item-type="${type}" data-key="@${paper.key}" data-item-type="${paper.data.itemType}" data-item-year="${paper.meta.parsedDate ? new Date(paper.meta.parsedDate).getUTCFullYear() : ""}" in-graph="false">
                <div class="related_year">${paper.meta.parsedDate ? new Date(paper.meta.parsedDate).getUTCFullYear() : ""}</div>
                <div class="related_info">
                    <span class="zotero-roam-search-item-authors ${accent_class}">${paper.meta.creatorSummary || ""}</span><span class="zr-secondary">${paper.data.publicationTitle || paper.data.bookTitle || ""}</span>
                    <span class="zotero-roam-search-item-title">${paper.data.title}</span>
                </div>
                <div class="related_state">
                    ${zoteroRoam.utils.renderBP3Button_group(string = `@${paper.key}`, {buttonClass: `bp3-minimal zr-text-small zotero-roam-page-menu-backlink-add-sidebar`, icon: "plus", buttonAttribute: `data-title="@${paper.key}" title="Add & open in sidebar" aria-label="Add & open @${paper.key} in the sidebar"`})}
                </div>
                </li>`
            }
        },

        renderBacklinksItem(paper, type, uid = null){
            let icon = type == "reference" ? "citation" : "chat";
            let accent_class = type == "reference" ? "zr-highlight" : "zr-highlight-2";
            if(uid){
                return `
                <li class="related-item_listed" item-type="${type}" data-key="@${paper.key}" in-graph="true">
                <div class="related_info">
                <a class="related_info-wrapper" href="${window.location.hash.match(/#\/app\/([^\/]+)/g)[0]}/page/${uid}"><span><span class="bp3-icon bp3-icon-${icon}"></span>${zoteroRoam.utils.formatItemReference(paper, "zettlr_accent", {accent_class: accent_class})}</span></a>
                </div>
                <div class="related_state">
                ${zoteroRoam.utils.renderBP3Button_group(string = "", {buttonClass: "bp3-minimal zotero-roam-page-menu-backlink-open-sidebar", icon: "inheritance", buttonAttribute: `data-uid="${uid}" title="Open in sidebar"`})}
                </div>
                </li>`;
            } else {
                return `
                <li class="related-item_listed" item-type="${type}" data-key="@${paper.key}" in-graph="false">
                <div class="related_info">
                <span class="related_info-wrapper"><span class="bp3-icon bp3-icon-${icon}"></span>${zoteroRoam.utils.formatItemReference(paper, "zettlr_accent", {accent_class: accent_class})}</span>
                </div>
                <div class="related_state">
                ${zoteroRoam.utils.renderBP3Button_group(string = "", {buttonClass: "bp3-minimal zotero-roam-page-menu-backlink-add-sidebar", icon: "add", buttonAttribute: `data-title="@${paper.key}" title="Add & open in sidebar"`})}
                </div>
                </li>`
            }
        },

        renderBacklinksList_year(papers, origin_year){
            let papersInGraph = new Map(zoteroRoam.utils.getAllRefPages());
            let papersList = papers.sort((a,b) => {
                if(!a.meta.parsedDate){
                    if(!b.meta.parsedDate){
                        return a.meta.creatorSummary < b.meta.creatorSummary ? -1 : 1;
                    } else {
                        return 1;
                    }
                } else {
                    if(!b.meta.parsedDate){
                        return -1;
                    } else {
                        let date_diff = new Date(a.meta.parsedDate).getUTCFullYear() - new Date(b.meta.parsedDate).getUTCFullYear();
                        if(date_diff < 0){
                            return -1;
                        } else if(date_diff == 0){
                            return a.meta.creatorSummary < b.meta.creatorSummary ? -1 : 1;
                        } else {
                            return 1;
                        }
                    }
                }
            });
            let referencesList = papersList.filter(p => p.type == "cited").map(p => {
                let paperUID = papersInGraph.get('@' + p.key) || null;
                return zoteroRoam.inPage.renderBacklinksItem_year(p, "reference", uid = paperUID);
            });
            let citationsList = papersList.filter(p => p.type == "citing").map(p => {
                let paperUID = papersInGraph.get('@' + p.key) || null;
                return zoteroRoam.inPage.renderBacklinksItem_year(p, "citation", uid = paperUID);
            });

            return `
            <ul class="related-sublist bp3-list-unstyled" list-type="references">
                ${referencesList.join("\n")}
            </ul>
            <span class="backlinks-list_divider">
                <span class="bp3-tag bp3-minimal">${origin_year}</span>
                <hr>
            </span>
            <ul class="related-sublist bp3-list-unstyled" list-type="citations">
                ${citationsList.join("\n")}
            </ul>
            `;
        },

        renderBacklinksList(papers){
            let citationsInLib = papers.filter(p => p.type == "citing");
            let referencesInLib = papers.filter(p => p.type == "cited");
            let referencesList = [];
            let citationsList = [];
            if(referencesInLib.length > 0){
                referencesList = referencesInLib.sort((a,b) => (a.meta.creatorSummary < b.meta.creatorSummary ? -1 : 1)).map(paper => {
                    let paperUID = zoteroRoam.utils.lookForPage('@' + paper.key).uid || null;
                    return zoteroRoam.inPage.renderBacklinksItem(paper, "reference", uid = paperUID);
                });
            }
            if(citationsInLib.length > 0){
                citationsList = citationsInLib.sort((a,b) => (a.meta.creatorSummary < b.meta.creatorSummary ? -1 : 1)).map(paper => {
                    let paperUID = zoteroRoam.utils.lookForPage('@' + paper.key).uid || null;
                    return zoteroRoam.inPage.renderBacklinksItem(paper, "citation", uid = paperUID);
                });
            }
            let fullLib = [...referencesList, ...citationsList];
            // https://flaviocopes.com/how-to-cut-array-half-javascript/
            let half = Math.ceil(fullLib.length / 2);
            let firstHalf = [];
            let secondHalf = [];
            if(referencesList.length > half){
                firstHalf = referencesList.slice(0, half);
                secondHalf = [...citationsList, ...referencesList.slice(half)];
            } else {
                firstHalf = fullLib.slice(0, half);
                secondHalf = fullLib.slice(half);
            }
            return `
            <ul class="col-1-left bp3-list-unstyled">
            ${firstHalf.join("")}
            </ul>
            <ul class="col-2-right bp3-list-unstyled">
            ${secondHalf.join("")}
            </ul>
            `
        },

        addWebImport(){
            let tags = zoteroRoam.config.params.webimport.tags;
            // Allow for multiple trigger tags
            let tagList = tags.constructor === Array ? tags : [tags];
            // Template for button
            let exploBtn = document.createElement('button');
            exploBtn.setAttribute('type', 'button');
            exploBtn.classList.add('bp3-button');
            exploBtn.classList.add('bp3-minimal');
            exploBtn.classList.add('zotero-roam-explo-import');
            exploBtn.innerHTML = `<span icon="geosearch" class="bp3-icon bp3-icon-geosearch"></span>`;
            // Get all blocks with trigger tags
            let trigBlocks = Array.from(document.querySelectorAll('.rm-block:not(.rm-block--ghost)')).filter(b => zoteroRoam.utils.matchArrays(tagList, JSON.parse(b.getAttribute('data-page-links'))));
            trigBlocks.forEach(b => {
                let links = b.querySelectorAll('.rm-block a:not(.rm-alias--page):not(.rm-alias--block)');
                let firstElem = b.firstChild;
                if(links.length > 0){
                    b.setAttribute('data-zr-explo', 'true');
                    if(!Array.from(firstElem.classList).includes('zotero-roam-explo-import')){
                        b.insertAdjacentElement('afterbegin', exploBtn.cloneNode(true));
                    }
                } else {
                    b.setAttribute('data-zr-explo', 'false');
                    if(Array.from(firstElem.classList).includes('zotero-roam-explo-import')){
                        firstElem.remove();
                    }
                }
            })
        }
    }
})();
