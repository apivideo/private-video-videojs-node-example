const http = require('http');
const url = require('url');
const base64 = require('base-64');

const vodUrl = 'https://vod.api.video/vod/';
const wsUrl = 'https://ws.api.video/videos/';
//const sample video id = 'xxxxxxxx';
const apiKey = 'Your API key';

/************************************************************************
 *  This is an example of how you can handle private videos with the
 *  use of session tokens. In the example we will create an HTTP server
 *  that will handle incoming GET requests, with the video id in the 
 *  query string. Then it will make a request to get the video id from 
 *  the https://ws.api.video/videos/ endpoint, extract the private token
 *  , get the session token from the /session endpoint and finally consume
 *  the video and thumbnail.
 * ***********************************************************************/

// 1 - First create a server that will accept GET requests, with id as query parameter

const server = http.createServer( async (req, res) =>  {
    const videoIdFromReq = url.parse(req.url, true).query.id;
    const videoDetails = await getVideoDetailsById(videoIdFromReq);
    const privateToken = await videoDetails.extractPrivateTokenAssets();
    const sessionToken = await videoDetails.getSessionToken(privateToken);
    const html = await generateHTML(videoDetails.data, sessionToken);
    res.write(html);
});

server.listen(3000);
console.log('Node.js web server at port 3000 is running..')

// 2 - Create a handler function for the requests to api.video endpoints with the basic auth
const apiVideoReq = async (url) => {
    const headers = new Headers();
    headers.append('Authorization', 'Basic' + base64.encode(apiKey + ":"));
    const response = await fetch(url, {headers});
    return {
        httpRawResponse: response,
        processHTTPresponse: async () => {
            if(response.status === 200) {
                const data = await response.json();
                return data;
            } else {
                throw new Error(`unbale to prase JSON, got response status: ${response.status}`)
            }
        }
    }
}

// 3 - Create a function to get the video by id reusing the above functions
const getVideoDetailsById = async (videoId) => {
    const completeUrlWithVideoId = `${wsUrl}${videoId}`
    const apiResponse = await apiVideoReq(completeUrlWithVideoId);
    const videoDetails = await apiResponse.processHTTPresponse();
    return {
        data: videoDetails,
        // 4 - extract the private token from the assets response
        extractPrivateTokenAssets: async () => {
            const regexBtwnTokenMp4 = /(?<=token\/)(.*?)(?=\/mp4)/;
            const regexMatchResults = videoDetails.assets.mp4.match(regexBtwnTokenMp4);
            if(regexMatchResults.length > 0) {
                return regexMatchResults[0]
            } else {
                throw new Error(`Was not able to find the private token the asset url: ${assetUrl}`)
            }
        },
        // 5 - get the session token while passing the private token
        getSessionToken: async (privateToken) => {
            const sessionUrlWithVideoIdAndToken = `${vodUrl}${videoId}/token/${privateToken}/session`
            const res = await apiVideoReq(sessionUrlWithVideoIdAndToken);
            const data = await res.processHTTPresponse(res);
            return data.session_token;   
        }
    }
}

// 6 - generate the HTML with video.js, the mp4 url and the thumbnail, while passing in the session token
const generateHTML = async (data, sessionToken) => {

    if(data.assets && data.assets.mp4 && data.assets.thumbnail) {
        const mp4Url = data.assets.mp4;
        const thumbnailUrl = data.assets.thumbnail;
        return `<html>
        <head>
        <div style="max-width: 150px" >
        <img
        style="max-width:100%;" 
        src="${thumbnailUrl}?avh=${sessionToken}">
        </div>
        </head>
        <body><video
        controls
        preload="auto"
        width="640"
        height="264"
        data-setup="{}"><source src="${mp4Url}?avh=${sessionToken}" type="video/mp4" /></body></html>`
    }
}