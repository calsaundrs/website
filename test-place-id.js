function extractGooglePlaceId(input) {
    if (!input || typeof input !== 'string') return null;
    
    if (input.startsWith('ChIJ') || input.startsWith('0x')) {
        return input;
    }
    
    const urlPatterns = [
        /\/place\/[^\/]+\/([^\/\?]+)/,
        /\/maps\/place\/[^\/]+\/([^\/\?]+)/,
        /[?&]cid=([^&]+)/,
        /[?&]place_id=([^&]+)/,
        /!1s([^!]+)!/,
    ];
    
    for (const pattern of urlPatterns) {
        const match = input.match(pattern);
        if (match && match[1]) {
            const placeId = match[1];
            if (placeId.startsWith('ChIJ') || placeId.startsWith('0x')) {
                return placeId;
            }
        }
    }
    
    return input;
}

const url = 'https://www.google.com/maps/place/Eden+Bar/@52.9446944,-3.0554318,9z/data=!4m6!3m5!1s0x4870bc632404df1b:0x30887b950fadaed5!8m2!3d52.4697266!4d-1.8952398!16s%2Fg%2F1tdw7h94!5m1!1e1?entry=ttu&g_ep=EgoyMDI1MDgxMS4wIKXMDSoASAFQAw%3D%3D';
console.log('URL:', url);
console.log('Extracted Place ID:', extractGooglePlaceId(url));
