"""Loopback-only ingress mirroring deployment API/storage routing for browser QA."""
import os
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.request import Request, build_opener, HTTPRedirectHandler, ProxyHandler
from urllib.error import HTTPError
class PreserveRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

# Forward redirects to the browser rather than invisibly resolving them here.
# All upstreams are explicit loopback origins; never use an environment proxy.
upstream = build_opener(ProxyHandler({}), PreserveRedirects())

class Handler(BaseHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def route(self):
        backend=self.path.startswith(('/api/','/storage/','/healthz'))
        origin=os.environ.get('LOCAL_QA_BACKEND_ORIGIN', 'http://127.0.0.1:8313') if backend else os.environ.get('LOCAL_QA_FRONTEND_ORIGIN', 'http://127.0.0.1:3314')
        data=self.rfile.read(int(self.headers.get('Content-Length','0'))) if self.headers.get('Content-Length') else None
        headers={k:v for k,v in self.headers.items() if k.lower() not in {'connection','transfer-encoding','accept-encoding'}}
        try:
            response=upstream.open(Request(origin+self.path,data=data,headers=headers,method=self.command),timeout=60)
        except HTTPError as error:
            response=error
        body=response.read()
        self.send_response(response.status)
        for key,value in response.headers.items():
            if key.lower() not in {'connection','transfer-encoding','content-length','content-encoding'}:
                self.send_header(key,value)
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        if self.command!='HEAD': self.wfile.write(body)
    do_GET=do_POST=do_PUT=do_PATCH=do_DELETE=do_HEAD=do_OPTIONS=route
ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('LOCAL_QA_INGRESS_PORT', '3313'))),Handler).serve_forever()
