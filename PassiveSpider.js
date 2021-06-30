// ==UserScript==
// @name         PassiveSpider
// @namespace    PentestToolset
// @version      0.1
// @description  Extract hidden url from html and javascript files.
// @author       KazZey0
// @match        *://*/*
// @require      https://greasyfork.org/scripts/12447-mootools-for-greasemonkey/code/MooTools%20for%20Greasemonkey.js?version=74469
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==
(function() {
    'use strict';

    // A patch for mootools

    Request.HTML = new Class({

        Extends: Request,

        options: {
            update: false,
            append: false,
            evalScripts: true,
            filter: false,
            headers: {
                Accept: 'text/html, application/xml, text/xml, */*'
            }
        },

        success: function(text){
            var options = this.options, response = this.response;

            response.html = text.stripScripts(function(script){
                response.javascript = script;
            });

            var match = response.html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            if (match) response.html = match[1];
            var temp = new Element('div').set('html', response.html);

            response.tree = temp.childNodes;
            response.elements = temp.getElements(options.filter || '*');

            if (options.filter) response.tree = response.elements;
            if (options.update){
                var update = document.id(options.update).empty();
                if (options.filter) update.adopt(response.elements);
                else update.set('html', response.html);
            } else if (options.append){
                var append = document.id(options.append);
                if (options.filter) response.elements.reverse().inject(append);
                else append.adopt(temp.getChildren());
            }

            this.onSuccess(response.tree, response.elements, response.html, response.javascript);
        }
    });

    Element.Properties.load = {

        set: function(options){
            var load = this.get('load').cancel();
            load.setOptions(options);
            return this;
        },

        get: function(){
            var load = this.retrieve('load');
            if (!load){
                load = new Request.HTML({data: this, link: 'cancel', update: this, method: 'get'});
                this.store('load', load);
            }
            return load;
        }
    };

    Element.implement({

        load: function(){
            this.get('load').send(Array.link(arguments, {data: Type.isObject, url: Type.isString}));
            return this;
        }
    });


    // Dialog code
    var dialogDiv = document.createElement('div');
    var dialogText = document.createElement('textarea');
    var domainList = "dmRecord_"+getMainHost();
    var urlList = "urlRecord_"+getMainHost();
    var scanList = "scanRecord_"+getMainHost();
    function showDialog() {
        function CleanCache(){
            var elem = document.getElementById("dialogDiv");
            if (elem) {
                clear(elem);
                function clearInner(node) {
                    while (node.hasChildNodes()) {
                        clear(node.firstChild);
                    }
                }

                function clear(node) {
                    while (node.hasChildNodes()) {
                        clear(node.firstChild);
                    }
                    node.parentNode.removeChild(node);
                }
                dialogDiv = document.createElement('div');
                dialogText = document.createElement('textarea');
            }
        }
        function AddMaskDiv(){
            dialogDiv.id = "dialogDiv";
            dialogDiv.style = "position:fixed;left:0%;top:8%;width:18%;height:70%;background-color:#ffffff;z-index:10001;font-size:14px;line-height:1.5;display:'none'";
            dialogText.id = "_FindSrcPic_ResultTextArea";
            dialogText.style = "position:relative;height:90%;width:100%"
            dialogDiv.appendChild(dialogText);

            var buttonArea = document.createElement('div');
            buttonArea.id = "buttonArea"
            buttonArea.innerHTML = '<input type=button value=Start id="dialogDiv_start"/>&nbsp;&nbsp;&nbsp;<input type=button value=Clear id="dialogDiv_clear"/>&nbsp;&nbsp;&nbsp;<input type=button value=Refresh id="dialogDiv_refresh"/>&nbsp;&nbsp;&nbsp;<input type=button value=Return id="dialogDiv_return"/><br/>';
            buttonArea.style = "position:relative;height:10%;width:100%"
            dialogDiv.appendChild(buttonArea);
            document.body.appendChild(dialogDiv);
            document.getElementById('dialogDiv_return').addEventListener("click", function(){document.getElementById('dialogDiv').style.display = "none";});
            document.getElementById('dialogDiv_start').addEventListener("click", function(){main();});
            document.getElementById('dialogDiv_clear').addEventListener("click", function(){dialogText.value = "";GM_setValue(urlList,JSON.encode([]));GM_setValue(domainList,JSON.encode([]));GM_setValue(scanList,JSON.encode([]));});
            document.getElementById('dialogDiv_refresh').addEventListener("click", function(){LoadData();});
        }
        function LoadData(){
            let msg = ""
            let collected_domain = JSON.decode(GM_getValue(domainList,[]));
            if(collected_domain == null) collected_domain = [];
            msg += collected_domain.length + "\n";
            collected_domain.forEach(a=>{
                msg += (a + "\n");
            });
            msg += "\n\n"
            msg += "scanned url:"+ scanList+" " + global_scan.size + "\n\n";
            let collected_url = JSON.decode(GM_getValue(urlList,[]));
            if(collected_url == null) collected_url = [];
            msg += collected_url.length + "\n";
            collected_url.forEach(a=>{
                msg += (a + "\n");
            });
            msg += "\n\n"

            dialogText.value = msg;
        }
        CleanCache();
        AddMaskDiv();
    }

    // Core logic
    function getMainHost() {
        let key = `mh_${Math.random()}`;
        let keyR = new RegExp( `(^|;)\\s*${key}=12345` );
        let expiredTime = new Date( 0 );
        let domain = document.domain;
        let domainList = domain.split( '.' );
        let urlItems = [];
        urlItems.unshift( domainList.pop() );
        while( domainList.length ) {
            urlItems.unshift( domainList.pop() );
            let mainHost = urlItems.join( '.' );
            let cookie = `${key}=${12345};domain=.${mainHost}`;
            document.cookie = cookie;
            if ( keyR.test( document.cookie ) ) {
                document.cookie = `${cookie};expires=${expiredTime}`;
                return mainHost;
            }
        }
    }
    function getHostname(referURL){
        let temp4;
        temp4=referURL.match(/http[s]*:\/\/([^\/]+)/);
        if(temp4){
            return temp4[1];
        }else{
            console.log("GetDomainName failed for:" + referURL);
            return ""
        }
    }

    function asynRequestRaw(url,callback){
        let myRequest = new Request({
            url: url,
            method: 'get',
            onRequest: function(){
            },
            onSuccess: function(responseText){
                // raw don't go depth
                requestSet.delete(url);
                callback(responseText);
                checkStatus();
            },
            onFailure: function(){
                requestSet.delete(url);
                checkStatus();
            }
        });
        myRequest.send();
    }

    function asynRequestHTML(url,depth,callback){
        let myRequest = new Request.HTML({
            url: url,
            method: 'get',
            onRequest: function(){
            },
            onSuccess: function(responseTree, responseElements, responseHTML, responseJavaScript){
                requestSet.delete(url);
                callback(responseElements,depth);
                checkStatus();
            },
            onFailure: function(){
                requestSet.delete(url);
                checkStatus();
            }
        });
        myRequest.send();
    }
    function extractFromJs(js_content){
        let regex = /(?:"|')(((?:[a-zA-Z]{1,10}:\/\/|\/\/)[^"'\/]{1,}\.[a-zA-Z]{2,}[^"']{0,})|((?:\/|\.\.\/|\.\/)[^"'><,;| *()(%%$^\/\\\[\]][^"'><,;|()]{1,})|([a-zA-Z0-9_\-\/]{1,}\/[a-zA-Z0-9_\-\/]{1,}\.(?:[a-zA-Z]{1,4}|action)(?:[\?|\/][^"|']{0,}|))|([a-zA-Z0-9_\-]{1,}\.(?:php|asp|aspx|jsp|json|action|html|js|txt|xml)(?:\?[^"|']{0,}|)))(?:"|')/sg;
        let m;
        let result = [];
        while ((m = regex.exec(js_content)) !== null) {
            if (m.index === regex.lastIndex) { regex.lastIndex++;}
            m.forEach((match, groupIndex) => {
                if (match != undefined) {
                    match = match.replaceAll(/('|")/g, "");
                    if (match.startsWith("http") == true){
                        let suburl = new URL(match);
                        if (suburl.host.endsWith(getMainHost()) == true){ result.push(match); }
                    }else{
                        let url = new URL(match, location.origin);
                        if (url.host.endsWith(getMainHost()) == true){ result.push(url.href); }
                    }}});}
        result = Array.from(new Set(result));
        result.forEach(a=>{
            global_url.push(a);
        });
    }
    function checkStatus(){
        if (requestSet.size == 0){
            let collected_domain = JSON.decode(GM_getValue(domainList,[]));
            if(collected_domain == null) collected_domain = [];
            let collected_url = JSON.decode(GM_getValue(urlList,[]));
            if(collected_url == null) collected_url = [];
            global_domain = Array.from(new Set(global_domain.concat(collected_domain)));
            global_url = Array.from(new Set(global_url.concat(collected_url)));
            GM_setValue(domainList,global_domain);
            GM_setValue(urlList,global_url);
            GM_setValue(scanList,global_scan);
            console.log(global_scan);
        }
    }

    var global_domain = [];
    var global_url = [];
    var global_scan = new Set();
    var requestSet = new Set();

    function extractFromElement(responseElement, depth){
        let js_content = "";
        let urls = [];
        $$(responseElement).forEach(element => {
            urls.push(element.src);urls.push(element.href);urls.push(element.url);
            if (element.tagName == "SCRIPT") { js_content += element.text }
        });
        extractFromJs(js_content);
        urls = Array.from(new Set(urls));
        urls.forEach(rawurl => {
            if (rawurl != undefined && rawurl != "" && typeof(rawurl) == "string" && rawurl.startsWith("http") == true){
                let url = new URL(rawurl);
                // collect domain
                if (url.host.endsWith(getMainHost()) == true) { global_domain.push(url.host)};
                // collect useful url
                let ext = url.href.split('/').pop().split('.').pop().toLowerCase();
                if (ext.search("\\?") != -1) {
                    ext = ext.split("?").shift().toLowerCase();
                }
                if (ext.search("\\#") != -1) {
                    ext = ext.split("#").shift().toLowerCase();
                }
                if ("jpeg|png|gif|svg|js|flv|swf|css|ico".search(ext) == -1){
                    global_url.push(url.href);
                }

                if (depth > 0) {
                    // old:url.host.endsWith(location.host) == true
                    if (url.host == location.host && global_scan.has(url.href) == false){
                        if(url.pathname.endsWith(".js") == true) {
                            // TODO: 
                            requestSet.add(url.href);
                            if (depth > 1){
                                global_scan.add(url.href);
                            }
                            asynRequestRaw(url.href,extractFromJs);
                        } else {
                            // TODO: url
                            if (("jpeg|png|gif|svg|flv|swf|css|ico".search(ext) == -1) && (url.pathname.toLowerCase().search("logout") == -1) && (url.pathname.toLowerCase().search("signout") == -1)){
                                requestSet.add(url.href);
                                if (depth > 1){
                                    global_scan.add(url.href);
                                }
                                asynRequestHTML(url.href,depth - 1,extractFromElement);
                            }
                        }
                    }
                }
            }
        });
    }

    function main(){
        global_scan = JSON.decode(GM_getValue(scanList,[]));
        if(global_scan == null) global_scan = [];
        global_scan = new Set(global_scan);
        extractFromElement($$('*'),1);
    }

    GM_registerMenuCommand('Show Dialog',showDialog);

    main();
})();
