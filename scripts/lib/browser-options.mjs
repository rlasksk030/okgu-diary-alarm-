export function browserOptions(origin){
 const url=new URL(origin),proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
 return {executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox'],...(proxy&&!['127.0.0.1','localhost'].includes(url.hostname)?{proxy:{server:proxy,bypass:'127.0.0.1,localhost'}}:{})};
}
