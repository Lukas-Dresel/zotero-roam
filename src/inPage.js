;(()=>{
    zoteroRoam.inPage = {

        addContextMenuListener() {
            var refCitekeys = document.querySelectorAll(".ref-citekey");
            for (var i = 0; i < refCitekeys.length; i++) {
                var ref = refCitekeys[i];
        
                // Handle case where item hasn't been checked against data yet
                if(!ref.dataset.zoteroBib){
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

        async addPageMenus(){
            zoteroRoam.utils.sleep(100);
            let openPages = Array.from(document.querySelectorAll("h1.rm-title-display"));
            for(const page of openPages) {
                let title = page.querySelector("span") ? page.querySelector("span").innerText : "";
                if(title.startsWith("@")){
                    let itemInLib = zoteroRoam.data.items.find(it => it.key == title.slice(1));
                    // If the item is in the library
                    if(typeof(itemInLib) !== 'undefined'){
                        let itemDOI = !itemInLib.data.DOI ? "" : zoteroRoam.utils.parseDOI(itemInLib.data.DOI);
                        // Check if div wrapper already exists, creates it otherwise
                        if(page.parentElement.querySelector(".zotero-roam-page-div") == null){
                            let pageDiv = document.createElement("div");
                            pageDiv.classList.add("zotero-roam-page-div");
                            if(itemDOI){
                                pageDiv.innerHTML = `
                                <span class="zotero-roam-page-doi" data-doi="${itemDOI}">
                                <a href="https://doi.org/${itemDOI}" class="bp3-text-muted" target="_blank">${itemDOI}</a>
                                </span>
                                `;
                            }
                            
                            page.parentElement.appendChild(pageDiv);
                        }

                        // List of default elements to include
                        let menu_defaults = zoteroRoam.config.params.pageMenu.defaults;

                        // Page menu
                        if(page.parentElement.querySelector(".zotero-roam-page-menu") == null){
                            let menuDiv = document.createElement("div");
                            menuDiv.classList.add("zotero-roam-page-menu");

                            page.parentElement.querySelector(".zotero-roam-page-div").appendChild(menuDiv);

                            // "Add metadata"
                            let addMetadata_element = ``;
                            if(menu_defaults.includes("addMetadata")){
                                addMetadata_element = zoteroRoam.utils.renderBP3Button_group(string = "Add metadata", {buttonClass: "bp3-minimal zotero-roam-page-menu-add-metadata", icon: "add"});
                            }

                            let itemChildren = zoteroRoam.formatting.getItemChildren(itemInLib, { pdf_as: "raw", notes_as: "raw" });
                            
                            // "Import notes"
                            let importNotes_element = ``;
                            if(menu_defaults.includes("importNotes")){
                                importNotes_element = !itemChildren.notes ? "" : zoteroRoam.utils.renderBP3Button_group(string = "Import notes", {buttonClass: "bp3-minimal zotero-roam-page-menu-import-notes", icon: "comment"});
                            }

                            // "View item information"
                            let viewItemInfo_element = ``;
                            if(menu_defaults.includes("viewItemInfo")){
                                viewItemInfo_element = zoteroRoam.utils.renderBP3Button_group(string = "View item information", {buttonClass: "bp3-minimal zotero-roam-page-menu-view-item-info", icon: "info-sign"});
                            }

                            let openZoteroLocal_element = ``;
                            if(menu_defaults.includes("openZoteroLocal")){
                                openZoteroLocal_element = zoteroRoam.utils.renderBP3Button_link(string = "Open in Zotero (local)", {linkClass: "bp3-minimal zotero-roam-page-menu-open-zotero-local", target: zoteroRoam.formatting.getLocalLink(itemInLib, {format: "target"}), linkAttribute: `target="_blank"`});
                            }
                            let openZoteroWeb_element = ``;
                            if(menu_defaults.includes("openZoteroWeb")){
                                openZoteroWeb_element = zoteroRoam.utils.renderBP3Button_link(string = "Open in Zotero (web)", {linkClass: "bp3-minimal zotero-roam-page-menu-open-zotero-web", target: zoteroRoam.formatting.getWebLink(itemInLib, {format: "target"}), linkAttribute: `target="_blank"`});
                            }

                            // PDF links
                            let pdfLinks_element = ``;
                            if(menu_defaults.includes("pdfLinks")){
                                pdfLinks_element =!itemChildren.pdfItems ? "" : itemChildren.pdfItems.map(item => {
                                    let libLoc = item.library.type == "group" ? `groups/${item.library.id}` : `library`;
                                    let pdfHref = (["linked_file", "imported_file", "imported_url"].includes(item.data.linkMode)) ? `zotero://open-pdf/${libLoc}/items/${item.data.key}` : item.data.url;
                                    let pdfTitle = item.data.filename || item.data.title;
                                    return zoteroRoam.utils.renderBP3Button_link(string = pdfTitle, {linkClass: "bp3-minimal zotero-roam-page-menu-pdf-link", icon: "paperclip", target: pdfHref, linkAttribute: `target="_blank"` });
                                }).join("");
                            }

                            // Web records
                            let records_list = [];
                            // Connected Papers
                            if(menu_defaults.includes("connectedPapers")){
                                records_list.push(zoteroRoam.utils.renderBP3Button_link(string = "Connected Papers", {icon: "layout", linkClass: "bp3-minimal bp3-intent-primary zotero-roam-page-menu-connected-papers", linkAttribute: `target="_blank"`, target: `https://www.connectedpapers.com/${(!itemInLib.data.DOI) ? "search?q=" + encodeURIComponent(itemInLib.data.title) : "api/redirect/doi/" + itemDOI}`}));
                            }
                            // Semantic Scholar
                            if(menu_defaults.includes("semanticScholar")){
                                records_list.push((!itemInLib.data.DOI) ? "" : zoteroRoam.utils.renderBP3Button_link(string = "Semantic Scholar", {icon: "bookmark", linkClass: "bp3-minimal bp3-intent-primary zotero-roam-page-menu-semantic-scholar", linkAttribute: `target="_blank"`, target: `https://api.semanticscholar.org/${itemDOI}`}));
                            }
                            // Google Scholar
                            if(menu_defaults.includes("googleScholar")){
                                records_list.push(zoteroRoam.utils.renderBP3Button_link(string = "Google Scholar", {icon: "learning", linkClass: "bp3-minimal bp3-intent-primary zotero-roam-page-menu-google-scholar", linkAttribute: `target="_blank"`, target: `https://scholar.google.com/scholar?q=${(!itemInLib.data.DOI) ? encodeURIComponent(itemInLib.data.title) : itemDOI}`}));
                            }

                            let backlinksLib = "";
                            if(menu_defaults.includes("citingPapers") && itemInLib.data.DOI){
                                let citeObject = await zoteroRoam.handlers.requestScitations(itemDOI);
                                let scitingDOIs = citeObject.citations.map(cit => cit.doi);
                                
                                if(scitingDOIs.length > 0){
                                    let doiPapers = zoteroRoam.data.items.filter(it => it.data.DOI);
                                    let papersInLib = doiPapers.filter(it => scitingDOIs.includes(zoteroRoam.utils.parseDOI(it.data.DOI)));
                                    backlinksLib = "<hr>";
                                    backlinksLib += zoteroRoam.utils.renderBP3Button_group(string = `${papersInLib.length > 0 ? papersInLib.length : "No"} citations in library`, {buttonClass: "bp3-minimal bp3-intent-success zotero-roam-page-menu-backlinks-button", icon: "caret-down bp3-icon-standard rm-caret rm-caret-closed"});

                                    backlinksLib += zoteroRoam.utils.renderBP3Button_group(string = `${scitingDOIs.length} citations available`, {buttonClass: "bp3-minimal bp3-intent-warning zotero-roam-page-menu-backlinks-total", icon: "citation", buttonAttribute: `data-doi=${itemDOI}`});

                                    if(papersInLib.length > 0){
                                        backlinksLib += `
                                        <ul class="zotero-roam-page-menu-backlinks-list bp3-list-unstyled bp3-text-small" style="display:none;">
                                        ${papersInLib.map(paper => {
                                            let paperInGraph = zoteroRoam.utils.lookForPage("@" + paper.key);
                                            switch(paperInGraph.present){
                                                case true:
                                                    return `
                                                    <li class="zotero-roam-page-menu-backlinks-item">
                                                    ${zoteroRoam.utils.renderBP3Button_group(string = "", {buttonClass: "bp3-minimal bp3-small zotero-roam-page-menu-backlink-open-sidebar", icon: "two-columns", buttonAttribute: `data-uid="${paperInGraph.uid}" title="Open in sidebar"`})}
                                                    <a href="${window.location.hash.match(/#\/app\/([^\/]+)/g)[0]}/page/${paperInGraph.uid}">${zoteroRoam.utils.formatItemReference(paper, "zettlr_accent")}</a>
                                                    </li>`;
                                                default:
                                                    return `
                                                    <li class="zotero-roam-page-menu-backlinks-item">
                                                    ${zoteroRoam.utils.renderBP3Button_group(string = "", {buttonClass: "bp3-minimal bp3-small zotero-roam-page-menu-backlink-add-sidebar", icon: "add-column-right", buttonAttribute: `data-title="@${paper.key}" title="Add & open in sidebar"`})}
                                                    ${zoteroRoam.utils.formatItemReference(paper, "zettlr_accent")}
                                                    </li>`
                                            }
                                        }).join("")}
                                        </ul>
                                        `
                                    }
                                }
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
                            ${records_list.length == 0 ? "" : records_list.join("")}
                            </div>
                            </div>
                            <div class="zotero-roam-page-menu-citations">
                            ${backlinksLib}
                            </div>
                            `;

                            // Adding event listeners for action buttons

                            try{
                                menuDiv.querySelector(".zotero-roam-page-menu-add-metadata").addEventListener("click", function(){
                                    let pageInGraph = zoteroRoam.utils.lookForPage(title);
                                    console.log(`Importing metadata to ${title} (${pageInGraph.uid})...`);
                                    zoteroRoam.handlers.addSearchResult(title, uid = pageInGraph.uid, {popup: true});
                                });
                            } catch(e){};
                            try{
                                menuDiv.querySelector(".zotero-roam-page-menu-import-notes").addEventListener("click", function(){
                                    let pageInGraph = zoteroRoam.utils.lookForPage(title);
                                    console.log(`Adding notes to ${title} (${pageInGraph.uid})...`);
                                    zoteroRoam.handlers.addItemNotes(title = title, uid = pageInGraph.uid);
                                });
                            } catch(e){};
                            try{
                                menuDiv.querySelector(".zotero-roam-page-menu-view-item-info").addEventListener("click", function(){
                                    zoteroRoam.interface.renderItemInPanel(citekey = title);
                                });
                            } catch(e){};
                            try{
                                let backlinksButton = menuDiv.querySelector(".zotero-roam-page-menu-backlinks-button");
                                backlinksButton.addEventListener("click", function(){
                                    // Change caret class & show the backlinks list
                                    let caretEl = backlinksButton.querySelector(".bp3-icon-caret-down");
                                    let backlinksList = backlinksButton.parentElement.querySelector(".zotero-roam-page-menu-backlinks-list");

                                    if(Array.from(caretEl.classList).includes("rm-caret-closed") && backlinksList){
                                        caretEl.classList.replace("rm-caret-closed", "rm-caret-open");
                                        backlinksList.style.display = "block";
                                    } else if(Array.from(caretEl.classList).includes("rm-caret-open")){
                                        caretEl.classList.replace("rm-caret-open", "rm-caret-closed");
                                        backlinksList.style.display = "none";
                                    }
                                });
                                let backlinksList = menuDiv.querySelector(".zotero-roam-page-menu-backlinks-list");
                                if(backlinksList){
                                    let backlinksInGraph = Array.from(backlinksList.querySelectorAll(".zotero-roam-page-menu-backlink-open-sidebar"));
                                    if(backlinksInGraph.length > 0){
                                        for(const el of backlinksInGraph){
                                            el.addEventListener("click", function(){
                                                zoteroRoam.utils.addToSidebar(uid = el.dataset.uid)
                                            })
                                        }
                                    }
                                    let backlinksLibOnly = Array.from(backlinksList.querySelectorAll(".zotero-roam-page-menu-backlink-add-sidebar"));
                                    if(backlinksLibOnly.length > 0){
                                        for(const el of backlinksLibOnly){
                                            el.addEventListener("click", async function(){
                                                let elUID = roamAlphaAPI.util.generateUID();
                                                roamAlphaAPI.createPage({'page': {'title': el.dataset.title, 'uid': elUID}});
                                                await zoteroRoam.handlers.addSearchResult(title = el.dataset.title, uid = elUID, {popup: false});
                                                zoteroRoam.utils.addToSidebar(uid = elUID);
                                            })
                                        }
                                    }
                                }
                            } catch(e){};
                            try{
                                let citationsButton = menuDiv.querySelector(".zotero-roam-page-menu-backlinks-total");
                                citationsButton.addEventListener("click", function(){
                                    zoteroRoam.interface.citations.overlay.querySelector(".header-content h5").innerText = `Papers citing ${title}`;
                                    let doi = citationsButton.getAttribute("data-doi");
                                    zoteroRoam.interface.popCitationsOverlay(doi);
                                });
                            } catch(e){};
                        }

                        // Badge from scite.ai
                        if(menu_defaults.includes("sciteBadge")){
                            if(itemInLib.data.DOI && page.parentElement.querySelector(".scite-badge") == null){
                                let sciteBadge = zoteroRoam.inPage.makeSciteBadge(doi = itemDOI);
                                page.parentElement.querySelector(".zotero-roam-page-menu-header").appendChild(sciteBadge);
                                // Manual trigger to insert badges
                                window.__SCITE.insertBadges();
                            }
                        }
                    } else {
                        try{
                            page.parentElement.querySelector(".zotero-roam-page-div").remove();
                        } catch(e){};
                    }
                }
            };
        },

        makeSciteBadge(doi, {layout = "horizontal", showZero = "true", showLabels = "false"} = {}){
            let sciteBadge = document.createElement("div");
            sciteBadge.classList.add("scite-badge");
            sciteBadge.setAttribute("data-doi", doi);
            sciteBadge.setAttribute("data-layout", layout);
            sciteBadge.setAttribute("data-show-zero", showZero);
            sciteBadge.setAttribute("data-show-labels", showLabels);

            return sciteBadge;
        }
    }
})();
