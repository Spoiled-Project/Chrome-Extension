
(function(){
    /**
     * Lock - a class that handle with race conditions when asynchronous functions runs together.
     */
    class Lock {
        /**
         * C-tor, holds the lock and a queue for the tasks that needs to do.
         */
        constructor() {
            this.isLocked = false;
            this.resolveQueue = [];
        }

        /**
         * This method is acquiring the lock. It waits until the lock will be free with waiting to Promise resolve.
         * @param priority If it is important to handle with the current thread as fast as possible, put here 1.
         * @returns {Promise<void>}
         */
        async acquire(priority) {
            return new Promise(resolve => {
                if (!this.isLocked) {
                    this.isLocked = true;
                    resolve();
                } else {
                    if (!!priority && priority===1)
                        this.resolveQueue.unshift(resolve)
                    else
                        this.resolveQueue.push(resolve);
                }
            });
        }

        /**
         * This method handle with the releasing of the lock. It calls to the next resolve function to release the next task
         */
        release() {
            if (this.resolveQueue.length > 0) {
                const nextResolve = this.resolveQueue.shift();
                nextResolve();
            } else {
                this.isLocked = false;
            }
        }
    }

    //const SERVER_URL = "https://spoiled-yofipfkyyq-zf.a.run.app/"
    const SERVER_URL = "http://127.0.0.1:8080"
    const USER_CHOICES = "userChoices";
    const MY_LOCK = new Lock();
    const BLOCK_IMAGE_PATH = chrome.runtime.getURL('images/blocked.png');
    const LOADING_IMAGE_PATH = chrome.runtime.getURL('images/loading.jpg');
    const CHECKED_SRC = new Map()
    const PIC_TAGS = 'source, img'
    const POSSIBLE_SRC_ATTR_NAMES = ['src','srcset','data-src']
    const IS_USER_CHANGE_PIC = "data-is-user-change"
    const OBSERVER_CONFIG = {attributes: true, childList: true, subtree: true, characterData: true}
    const INVALID_IMAGES_TYPES = ["svg","pdf","gif","webp","dng","tiff"]
    const INVALID_RESPONSE = "Spoiled extension failed to connect its server."
    const MAX_SIZE = 110
    let IS_SERVER_ERROR = false;
    let queue = new Set(); // hold elements to be sent to server
    let queueTimer = null; // hold timer



    /**
     * Return the size of an image
     * @param image - image element
     * @returns {{width: number, height: number}}
     */
    const getImageSize = (image) => {
        const width = Math.min(!!image.width ? image.width:MAX_SIZE, image.naturalWidth)
        const height = Math.min(!!image.height ? image.height: MAX_SIZE, image.naturalHeight)
        return { width , height};
    };

    /**
     * Return if an image is in valid size (weight or height >= MAX_SIZE)
     * @param width - a width in pixels.
     * @param height - a height in pixels
     * @returns {boolean} True if weight or height >= MAX_SIZE, otherwise false.
     */
    const isValidSize = (width,height)=>{
        return MAX_SIZE <= height || MAX_SIZE <=width
    }
    /**
     * Check if image src have a valid type.
     * @param src An image's source.
     * @returns {boolean} Return true if the type of the image is invalid.
     */
    const isInvalidType = (src) => {
        const extension = src.substring(src.lastIndexOf('.') + 1).toLowerCase();
        return INVALID_IMAGES_TYPES.some((val)=> val===extension);
    };

    /**
     * This function is executing when there is a timeout in queueTimer. It sends all the image elements' to
     * getServerResults function.
     * @returns {Promise<void>}
     */
    const processQueue = async () => {
        await MY_LOCK.acquire(1);
        if(queue.size > 0) {
            getServerResults(Array.from(queue));
            queue.clear();
        }
        queueTimer = null;
        MY_LOCK.release();
    };

    /**
     * This function is adding to the images elements' queue the new image element and start a timer if needed.
     * @param image An image's element
     * @returns {Promise<void>}
     */
    const enqueueImage = async (image) => {
        await MY_LOCK.acquire(0);
        queue.add(image);
        if(queueTimer === null) {
            queueTimer = setTimeout(processQueue, 1); // adjust time as needed
        }
        MY_LOCK.release();
    };

    /**
     * This function return the choices' the user make (the series he chose to block)
     * @returns {Promise<unknown | *[]>}
     */
    const getUserChoices = async () =>{
        return new Promise((res)=>{
            chrome.storage.local.get([USER_CHOICES], (obj)=>{
                res(obj[USER_CHOICES] ? JSON.parse(obj[USER_CHOICES]): [])
            });
        }). catch((err)=>{
            handleError(err)
            return [];
        })
    }
    /**
     * This function is handling with error when it appeared. It stops the work of the extension.
     * @param error -An error message, prints to the inspector.
     */
    const handleError = (error)=>{
        if (!IS_SERVER_ERROR)
            IS_SERVER_ERROR = true
        console.log(error)
    }
    /**
     * This function is handle with the response from the server - checks if the response is ok or not.
     * @param response - The response from the server.
     * @returns {Promise<never>|Promise<unknown>}
     */
    function status(response) {
        if (response.status >= 200 && response.status < 300) {
            return Promise.resolve(response)
        } else {
            return Promise.reject(new Error(response.statusText))
        }
    }
    /**
     * The function fetches the series list inside the server and saves it in
     * chrome.storage.local with a key named 'seriesList'.
     */
    function getResult(toServer, nodeMap){
        fetch(`${SERVER_URL}`, {method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(toServer)
        })
            .then(status)
            .then(function(response) {
                return response.json();
            })
            .then((res)=>{
                    handleResult(res,nodeMap);
                }
            )
            .catch((error) =>{
                clearLoadingFromImages(nodeMap)
                handleError(error)

            })

    }

    /**
     * This function is clearing the loading image from all the images' elements in the nodeMap
     * @param nodeMap - A map with all the sources that sent to the server. The map should look like that:
     * keys: sources that sends to the server.
     * values: a set with objects when each cell look like that:
     * {element:<the image's element include this src>, attribute:<the name of the attribute that includes this source (key)>}
     */
    const clearLoadingFromImages = (nodeMap)=>{
        [...nodeMap.entries()].forEach(([src, pairsElementAttribute])=>{
            Array.from(pairsElementAttribute).forEach(({element, attribute})=>{
                if (attribute==="currentSrc")
                    element.currentSrc = src;
                else
                    element.setAttribute(attribute,src)
            })
        })
    }

    /**
     * This function receives attribute's name and an image's element and change the attribute's source to BLOCK_IMAGE_PATH
     * @param attributeName The name of the attribute
     * @param currentNode the current image's node.
     */
    const changeAttributeToBlockImage = (attributeName, currentNode)=>{
        if (attributeName === "currentSrc")
            currentNode.currentSrc = BLOCK_IMAGE_PATH
        else
            currentNode.setAttribute(attributeName, BLOCK_IMAGE_PATH)

    }

    /**
     * This function add a listener to the images to reveal them after 2 seconds
     * @param attributeName The attribute that should be changed after 2 seconds
     * @param currentNode The image's element that should change its sources.
     * @param src The original source that was in this attribute.
     */
    const addExposeListener = (attributeName, currentNode, src)=>{
        let timeoutId;
        setTimeout(() => {
            currentNode.addEventListener("mouseenter", (event) => {
                timeoutId = setTimeout(() => {
                    if (attributeName === "currentSrc")
                        currentNode.currentSrc = src
                    else
                        currentNode.setAttribute(attributeName, src)
                    currentNode.setAttribute(IS_USER_CHANGE_PIC, true);
                }, 2000)
            })
            currentNode.addEventListener('mouseleave', () => {
                // Clear the timer if the mouse leaves the element before 2 seconds
                clearTimeout(timeoutId);
            });
        }, 1000)
    }
    /**
     * This function is checking if the result is ok.
     * @param res The result from the server.
     * @param nodeMap A map with all the sources that sent to the server. The map should look like that:
     * keys: sources that sends to the server.
     * values: a set with objects when each cell look like that:
     * {element:<the image's element include this src>, attribute:<the name of the attribute that includes this source (key)>}
     */
    const validateResults = (res, nodeMap)=>{
        const resArr = Object.keys(res)
        const nodeMapArr = [...nodeMap.keys()]
        const resSet = new Set (resArr)
        const nodeMapSet = new Set (nodeMapArr)
        if ( !(resArr.every(item=>nodeMapSet.has(item)) &&
               nodeMapArr.every(item=> resSet.has(item))&&
               Object.values(res).every(val=> typeof val === 'boolean'))
            )
            throw new Error(INVALID_RESPONSE)

    }

    /**
     * This function is handle with the results from the server.
     * @param res A json (returned from the server) having sources as keys and the values are true-for a spoiler,
     * false-not a spoiler.
     * @param nodeMap A map with all the sources that sent to the server. The map should look like that:
     * keys: sources that sends to the server.
     * values: a set with objects when each cell look like that:
     * {element:<the image's element include this src>, attribute:<the name of the attribute that includes this source (key)>}
     */
    function handleResult(res,nodeMap){
        validateResults(res,nodeMap)
        Object.entries(res).forEach(([src,isSpoiler])=>{
            let pairsElementAttribute = nodeMap.get(src);
            CHECKED_SRC.set(src,isSpoiler);
            if(!!pairsElementAttribute && !!pairsElementAttribute.size && isSpoiler) {
                Array.from(pairsElementAttribute).forEach(({element, attribute})=> {
                    element.setAttribute(IS_USER_CHANGE_PIC, false);
                    changeAttributeToBlockImage(attribute, element)
                    addExposeListener(attribute, element, src)

                })
            }
            else if (!isSpoiler){
                Array.from(pairsElementAttribute).forEach(({element, attribute})=>{
                    if (attribute==="currentSrc")
                        element.currentSrc = src;
                    else
                        element.setAttribute(attribute,src)
                })
            }
        })
    }

    /**
     * This function gets server result for all the sources.
     * @param elements An array of image's elements with the images that changed in any reason.
     */
    const getServerResults = async (elements = []) =>{
        let toServer = {"series":await getUserChoices(),"images":[]};
        if (!toServer.series.length || IS_SERVER_ERROR)
            return;
        let nodeMap = new Map();

        /**
         * This function is checking if there is need to add an element to the server.
         * @param src - The source of the current image's element.
         * @param element - The image's element.
         * @param attributeName - The attribute that has this source
         */
        const addElementToDataStructures = (src,element,attributeName)=>{
            if(!!src && src !== BLOCK_IMAGE_PATH && !isInvalidType(src)){
                let lastIsSpoiler = CHECKED_SRC.get(src)
                if ((lastIsSpoiler===null || lastIsSpoiler===undefined) && src!==LOADING_IMAGE_PATH) {
                    if (nodeMap.get(src))
                        nodeMap.get(src).add({element: element, attribute: attributeName});
                    else
                        nodeMap.set(src, new Set([{element: element, attribute:attributeName}]));
                    toServer.images.push(src);
                    if (attributeName === "currentSrc")
                        element.currentSrc = LOADING_IMAGE_PATH
                    else
                        element.setAttribute(attributeName, LOADING_IMAGE_PATH)
                }
                //if the src checked but there are attributes that changed again, replace them to BLOCK
                else if (lastIsSpoiler === true){
                        element.setAttribute(IS_USER_CHANGE_PIC, false);
                        changeAttributeToBlockImage(attributeName,element)
                        addExposeListener(attributeName,element,src)
                }
            }
        }
        for (let elem of elements){
            const {width,height} = getImageSize(elem)
            if (isValidSize(width,height)) {
                POSSIBLE_SRC_ATTR_NAMES.forEach((attributeName) => {
                    addElementToDataStructures(elem.getAttribute(attributeName), elem, attributeName)
                })
                addElementToDataStructures(elem.currentSrc, elem, "currentSrc")
            }
        }
        if (!!toServer.images.length){
            getResult(toServer, nodeMap);
        }
    }
    /**
     * Check if all the attributes are not change to BLOCK_PATH. That means that some attributes change by website's script
     * @param imageNode An image's element
     * @returns {*|boolean|boolean} True if there are attributes in the image's elements that are not changed to BLOCK_IMAGE
     */
    const isNotAllAttributesSetToBlock = (imageNode)=>{
        return (imageNode.currentSrc && imageNode.currentSrc!== BLOCK_IMAGE_PATH) ||
            POSSIBLE_SRC_ATTR_NAMES.some((attributeName) => {
                let src = imageNode.getAttribute(attributeName)
                return !!src && src!==BLOCK_IMAGE_PATH
            })
    }
    /**
     * Insert to the queue the image's node
     * @param imageNode - an image node that need to be inserted to the queue.
     */
    const insertToQueue = (imageNode)=>{
        if (imageNode.dataset.isUserChange == null ||
            (imageNode.dataset.isUserChange ==="false" && isNotAllAttributesSetToBlock(imageNode))){
            enqueueImage(imageNode);
        }
    }
    /**
     * Add to an image's element an event
     * @param imageNode - An image's node.
     * @param processedElements - A set of all the mutations' elements that done in the current iteration of the
     * mutation observer.
     */
    const addImageLoadEventIfNotHandled = (imageNode, processedElements)=>{
        if (!processedElements.has(imageNode) ) {
            processedElements.add(imageNode)
            imageNode.onload = function(){
                insertToQueue(imageNode)
            }
        }
    }

    /**
     * A listener to all the mutations in the website.
     * @type {MutationObserver}
     */
    const observe = new MutationObserver((mutations)=>{
        if (!document.body)
            return;

        const processedElements = new Set();
        mutations.forEach((mutation)=>{
            if (mutation.type === "attributes" &&
                POSSIBLE_SRC_ATTR_NAMES.some((elem)=>elem === mutation.attributeName)){
                const node = mutation.target;
                if (node.matches(PIC_TAGS) || node.tagName === 'IMG'){
                    addImageLoadEventIfNotHandled(node,processedElements)
                }
            }
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE){
                    if (node.matches(PIC_TAGS) || node.tagName === 'IMG'){
                        addImageLoadEventIfNotHandled(node,processedElements)
                    }
                    else{
                        const images = node.querySelectorAll(PIC_TAGS)
                        if (images.length) {
                            images.forEach(image=>{
                                addImageLoadEventIfNotHandled(image,processedElements)

                            })
                        }
                    }

                }
            })
        })
    })

    observe.observe(document.documentElement, OBSERVER_CONFIG);

})();