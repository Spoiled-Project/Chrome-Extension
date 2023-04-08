(function(){
    console.log("running pageImages")
    const BLOCK_IMAGE_PATH = chrome.runtime.getURL('images/block.jpg');
    const config = {childList: true, subtree:true, attributes: true}
    let observe;
    const PIC_TAGS = 'source, img, image'

    /**
     * Change the images for the first time - check if there are elements with tags' names that could hold an image
     * and send it to server check.
     */
    const changeImages = ()=>{
        let srcElements = document.querySelectorAll(PIC_TAGS);
        console.log(srcElements)
        getServerResults (srcElements)
    }
    /**
     * This function gets server result for all the sources. (the implementation is temporary)
     * @param elements
     */
    const getServerResults = (elements = []) =>{
        // temp implementation, will be change to server's check.
        elements.forEach((elem)=>{
            if (elem.hasAttribute('src')) {
                elem.setAttribute('src', BLOCK_IMAGE_PATH)
            }
            else if(elem.hasAttribute('srcset')) {
                elem.setAttribute('srcset', BLOCK_IMAGE_PATH)
            }

        })
    }


    console.log("init")

    //create a mutation observer to handle page changes
    observe = new MutationObserver((mutations)=>{
        let relevantNewElements = []
        console.log("mutation")
        mutations.forEach((mutation)=>{
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE){
                    console.log("here")
                    //console.log(node)
                    let elements = node.querySelectorAll(PIC_TAGS)
                    //console.log(elements)
                    if (elements.length)
                        relevantNewElements.push(...node.querySelectorAll(PIC_TAGS))
                }
            })
        })
        getServerResults(relevantNewElements)
    })
    changeImages()
    observe.observe(document,config)


})();