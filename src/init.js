
;(()=>{
    
    window.zoteroRoam = {

        Shortcut: function(obj) {
            this.action = obj.action;
            this.template = {
                altKey: false,
                ctrlKey: false,
                metaKey: false,
                shiftKey: false
            }
            this.watcher = {
                altKey: false,
                ctrlKey: false,
                metaKey: false,
                shiftKey: false
            }

            for(k in obj.template){
                this.template[`${k}`] = obj.template[`${k}`];
                this.watcher[`${k}`] = false;
            }
            // If the template was empty/all keys in the template are 'false', destroy the template (invalid)
            if(Object.keys(this.template).every(k => this.template[k] === false)){
                this.template = {};
            }
        },

        autoComplete: null,

        config: {
            autoComplete: {
                data: {
                    src: async function() {
                        if(zoteroRoam.data.items.length == 0){
                            return [];
                        } else {
                            return zoteroRoam.handlers.simplifyDataArray(zoteroRoam.data.items);
                        }
                    },
                    key: ['title', 'authorsLastNames', 'year', 'tagsString'],
                    cache: false,
                    results: (list) => {
                        // Make sure to return only one result per item in the dataset, by gathering all indices & returning only the first match for that index
                        const filteredMatches = Array.from(new Set(list.map((item) => item.index))).map((index) => {return list.find(item => item.index === index)});
                        return filteredMatches;
                    }
                },
                selector: '#zotero-search-autocomplete',
                searchEngine: 'strict',
                trigger: {
                    event: ["input", "focus"]
                },
                highlight: true,
                maxResults: 20,
                sort: (a, b) => { // Sort by author, alphabetically
                    if(a.value.authors.toLowerCase() < b.value.authors.toLowerCase()) return -1;
                    if(a.value.authors.toLowerCase() > b.value.authors.toLowerCase()) return 1;
                    return 0;
                },
                resultsList: {
                    className: "zotero-search-results-list",
                    idName: "zotero-search-results-list",
                    container: source => {
                        source.classList.add("bp3-menu");
                    }
                },
                resultItem: {
                    element: 'li',
                    className: "zotero-search_result",
                    idName: "zotero-search_result",
                    content: (data, element) => {
                        let itemCitekey = `<span class="bp3-menu-item-label zotero-search-item-key">${data.value.key}</span>`;
                        let itemMetadata = `<span class="zotero-search-item-metadata"> ${data.value.meta}</span>`;
                        let itemTitleContent = (data.key == "title") ? data.match : data.value.title;
                        let itemTitle = `<span class="zotero-search-item-title" style="font-weight:bold;color:black;display:block;">${itemTitleContent}</span>`;
            
                        let itemYear = "";
                        if(data.value.year){
                            let itemYearContent = (data.key == "year") ? data.match : data.value.year;
                            itemYear = `<span class="zotero-search-item-year"> (${itemYearContent})</span>`;
                        }
            
                        // Prepare authors element, if there are any
                        let itemAuthors = "";
                        if(data.value.authors){
                            // If the match is in the full list of authors, manually add the .autoComplete_highlighted class to the abbreviated authors span
                            if(data.key == "authorsLastNames"){
                                itemAuthors = `<span class="zotero-search-item-authors autoComplete_highlighted">${data.value.authors}</span>`;
                            } else {
                                itemAuthors = `<span class="zotero-search-item-authors">${data.value.authors}</span>`;
                            }
                        }
                        // Prepare tags element, if there are any
                        let itemTags = "";
                        if(data.value.tagsString){
                            let itemTagsContent = (data.key == "tagsString") ? data.match : data.value.tagsString;
                            itemTags = `<span class="zotero-search-item-tags" style="font-style:italic;color:#c1c0c0;display:block;">${itemTagsContent}</span>`;
                        }
            
                        // Render the element's template
                        element.innerHTML = `<a label="${data.value.key}" class="bp3-menu-item bp3-popover-dismiss">
                                            <div class="bp3-text-overflow-ellipsis bp3-fill zotero-search-item-contents">
                                            ${itemTitle}
                                            ${itemAuthors}${itemYear}${itemMetadata}
                                            ${itemTags}
                                            </div>
                                            ${itemCitekey}
                                            </a>`;
              
                    }
                },
                noResults: (dataFeedback, generateList) => {
                    // Generate autoComplete List
                    generateList(zoteroRoam.autoComplete, dataFeedback, dataFeedback.results);
                    // No Results List Item
                    const result = document.createElement("li");
                    result.setAttribute("class", "no_result");
                    result.setAttribute("tabindex", "1");
                    result.innerHTML = `<span style="display: flex; align-items: center; font-weight: 100; color: rgba(0,0,0,.2);">Found No Results for "${dataFeedback.query}"</span>`;
                    document
                        .querySelector(`#${zoteroRoam.autoComplete.resultsList.idName}`)
                        .appendChild(result);
                },
                onSelection: (feedback) => {
                    if(zoteroRoam.interface.search.quickCopyToggle.checked && !zoteroRoam.config.params.override_quickcopy.overridden){
                        zoteroRoam.interface.search.input.blur();
                        zoteroRoam.interface.search.input.value = '@' + feedback.selection.value.key;
                        zoteroRoam.interface.search.input.select();
                        document.execCommand("copy");
                        zoteroRoam.interface.toggleSearchOverlay("hide");
                    } else {
                        zoteroRoam.interface.search.input.blur();
                        zoteroRoam.interface.renderSelectedItem(feedback);
                    }
                }
            },
            params: {
                override_quickcopy: {overridden: false}
            },
            requests: {}, // Assigned the processed Array of requests (see handlers.setupUserRequests)
            shortcuts: [], // Assigned the processed Array of zoteroRoam.Shortcut objects (see shortcuts.setup)
            userSettings: {} // Assigned the value of the zoteroRoam_settings Object defined by the user (see run.js)
        },

        data: {items: [], collections: []},

        funcmap: {DEFAULT: "zoteroRoam.formatting.getItemMetadata"},

        typemap: {
            artwork: "Illustration",
            audioRecording: "Recording",
            bill: "Legislation",
            blogPost: "Blog post",
            book: "Book",
            bookSection: "Chapter",
            "case": "Legal case",
            computerProgram: "Data",
            conferencePaper: "Conference paper",
            document: "Document",
            email: "Letter",
            encyclopediaArticle: "Encyclopaedia article",
            film: "Film",
            forumPost: "Forum post",
            hearing: "Hearing",
            instantMessage: "Instant message",
            interview: "Interview",
            journalArticle: "Article",
            letter: "Letter",
            magazineArticle: "Magazine article",
            manuscript: "Manuscript",
            map: "Image",
            newspaperArticle: "Newspaper article",
            patent: "Patent",
            podcast: "Podcast",
            presentation: "Presentation",
            radioBroadcast: "Radio broadcast",
            report: "Report",
            statute: "Legislation",
            thesis: "Thesis",
            tvBroadcast: "TV broadcast",
            videoRecording: "Recording",
            webpage: "Webpage"
        },

        addAutoCompleteCSS(){
            let autoCompleteCSS = document.createElement('style');
            autoCompleteCSS.textContent = `ul#zotero-search-results-list::before{content:attr(aria-label);}
                                            li.autoComplete_selected{background-color:#e7f3f7;}
                                            span.autoComplete_highlighted{color:#146cb7;}
                                            .selected-item-header, .selected-item-body{display:flex;justify-content:space-around;}
                                            .selected-item-body{flex-wrap:wrap;}
                                            .item-basic-metadata, .item-additional-metadata{flex: 0 1 60%;}
                                            .item-rendered-notes{flex: 0 1 95%;margin-top:25px;}
                                            .item-citekey, .item-actions{flex:0 1 30%;}
                                            .item-citekey{margin:10px 0px;}
                                            .item-citekey input.bp3-input[readonly]{box-shadow:none;font-weight:bold;}
                                            span.zotero-roam-sequence{background-color:khaki;padding:3px 6px;border-radius:3px;font-size:0.85em;font-weight:normal;}`;
            document.head.append(autoCompleteCSS);
        }

    };

    // Load the autoComplete JS (if there's a better way, I'm all ears)
    // This should be done early on so that the autoComplete constructor is available & ready
    var ac = document.createElement("script");
    ac.src = "https://cdn.jsdelivr.net/npm/@tarekraafat/autocomplete.js@8.3.2/dist/js/autoComplete.js";
    ac.type = "text/javascript";
    document.getElementsByTagName("head")[0].appendChild(ac);

})();
