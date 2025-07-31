const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

exports.handler = async (event, context) => {
    try {
        const templatePath = path.join(__dirname, '..', '..', 'event-template.html');
        console.log('Template path:', templatePath);
        console.log('__dirname:', __dirname);
        console.log('Resolved path:', path.resolve(templatePath));
        
        // Check if file exists
        const exists = fs.existsSync(templatePath);
        console.log('Template file exists:', exists);
        
        if (exists) {
            const stats = fs.statSync(templatePath);
            console.log('File size:', stats.size, 'bytes');
            
            const content = fs.readFileSync(templatePath, 'utf8');
            console.log('Template loaded successfully, length:', content.length);
            
            const compiled = Handlebars.compile(content);
            console.log('Template compiled successfully');
            
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    templatePath: templatePath,
                    exists: true,
                    size: stats.size,
                    contentLength: content.length,
                    compiled: true
                })
            };
        } else {
            // List directory contents
            const dir = path.dirname(templatePath);
            const files = fs.readdirSync(dir);
            console.log('Directory contents:', files);
            
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: false,
                    templatePath: templatePath,
                    exists: false,
                    directory: dir,
                    directoryContents: files
                })
            };
        }
    } catch (error) {
        console.error('Debug error:', error);
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack
            })
        };
    }
}; 