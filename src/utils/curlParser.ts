import { RequestData } from '../dataManager';

export function parseCurl(curlText: string): Partial<RequestData> {
    const request: Partial<RequestData> = {
        method: 'GET',
        url: '',
        headers: '',
        body: '',
        queryParams: []
    };

    // 1. Clean up the string (handle multiline backslashes)
    const cleanCurl = curlText.replace(/\\\n/g, ' ').replace(/\n/g, ' ').trim();

    // 2. Extract Method
    const methodMatch = cleanCurl.match(/-X\s+([A-Z]+)/i) || cleanCurl.match(/--request\s+([A-Z]+)/i);
    if (methodMatch) {
        request.method = methodMatch[1].toUpperCase();
    }

    // 3. Extract URL
    // Look for first quoted string or a string starting with http
    const urlMatch = cleanCurl.match(/['"](https?:\/\/[^'"]+)['"]/) || cleanCurl.match(/\s+(https?:\/\/[^\s]+)/);
    if (urlMatch) {
        let fullUrl = urlMatch[1];
        if (fullUrl.includes('?')) {
            const [base, query] = fullUrl.split('?');
            request.url = base;
            request.queryParams = query.split('&').map(param => {
                const [key = '', value = ''] = param.split('=');
                return { key: decodeURIComponent(key), value: decodeURIComponent(value) };
            }).filter(p => p.key);
        } else {
            request.url = fullUrl;
            request.queryParams = [];
        }
    }

    // 4. Extract Headers
    const headerRegex = /(?:-H|--header)\s+["']([^"']+)["']/g;
    let headerMatch;
    const headersList: string[] = [];
    while ((headerMatch = headerRegex.exec(cleanCurl)) !== null) {
        headersList.push(headerMatch[1]);
    }
    request.headers = headersList.join('\n');

    // 5. Extract Body
    const dataMatch = cleanCurl.match(/(?:-d|--data(?:-raw)?|--data-binary)\s+['"](.+?)['"](?:\s+|$)/) ||
                      cleanCurl.match(/(?:-d|--data(?:-raw)?|--data-binary)\s+(\{[^}]+\})/); // handle unquoted JSON too
    
    if (dataMatch) {
        request.body = dataMatch[1];
        // If data is present and method is default GET, switch to POST
        if (!methodMatch) {
            request.method = 'POST';
        }
    }

    return request;
}
