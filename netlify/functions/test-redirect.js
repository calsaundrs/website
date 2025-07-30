exports.handler = async function(event, context) {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/html'
        },
        body: `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Redirect Test</title>
            </head>
            <body>
                <h1>Redirect Test Successful!</h1>
                <p>Event: ${event.queryStringParameters?.slug || 'No slug'}</p>
                <p>Path: ${event.path}</p>
                <p>Query: ${JSON.stringify(event.queryStringParameters)}</p>
            </body>
            </html>
        `
    };
}; 