'use strict';

require( '../../../common' );

var Url = require( 'url' );

describe( 'proxy index', function() {

  var index,
      fakeResponse,
      fakeProtocol;

  before( function() {
    fakeProtocol = {
      'on': sinon.stub(),
      'setTimeout': function() {},
      'abort': sinon.stub().returns( 'request aborted' )
    };

    fakeResponse = {
      'connection': {},
      'end': sinon.stub(),
      'writeHead': sinon.stub(),
      'on': sinon.stub()
    };

    index = rewire( '../src/proxy/index' );

    index.__set__( {
      'Http'          : {
        'get'           : sinon.stub().returns( fakeProtocol )
      },
      'Https'         : {
        'get'           : sinon.stub().returns( fakeProtocol )
      },
      'Url'           : {
        'parse'         : sinon.stub().returns( {
          'host':     'www.some-domain.com',
          'hostname': 'www.some-domain.com',
          'protocol': 'http:',
          'port': 80,
          'format': function(){}
        } )
      },
      'log'           : {
        'debug'         : function(){},
        'error'         : sinon.stub(),
        'warn'          : sinon.stub()
      },
      'transform'     : {
        'parseUrl'      : sinon.stub(),
        'parseQS'       : sinon.stub()
      },
      'media'         : {
        'reqOptions'    : sinon.stub()
      },
      'utils'          : {
        'fourOhFour'    : sinon.stub(),
        'finish'        : sinon.stub(),
        'getQS'         : sinon.stub()
      }
    } );
  } );

  describe( '#processUrl', function() {
    var urlTest;

    before( function() {
      index.__get__( 'utils' ).fourOhFour.returns( 'return from fourOhFour' );
      urlTest = Url.parse( 'http://www.some-domain.com/some/path' );
    } );

    after( function() {
      index.__get__( 'utils' ).fourOhFour.returns( void 0 );
    } );

    describe( 'when asset url host is NOT defined', function() {
      var bkpHost;

      before( function() {
        bkpHost = urlTest.host;
        urlTest.host = void 0;
      } );

      after( function() {
        urlTest.host = bkpHost;
      } );

      it( 'should respond with a 404', function() {
        index.__get__( 'utils' ).fourOhFour.reset();
        index.__get__( 'processUrl' )( urlTest, {}, fakeResponse, { 'redirects': 3, 'transform': undefined, 'reqUrl': 'http://localhost/encoded-key/encoded-url' } );
        expect( index.__get__( 'utils' ).fourOhFour ).to.have.been.calledOnce;
        expect( index.__get__( 'utils' ).fourOhFour.getCall( 0 ).args[ 0 ] ).to.be.equal( fakeResponse );
        expect( index.__get__( 'utils' ).fourOhFour.getCall( 0 ).args[ 1 ] ).to.contain( 'No host provided by url:' );
      } );
    } );

    describe( 'when asset url host is defined', function() {
      describe( 'with an INVALID protocol', function() {
        var bkpProtocol;

        before( function() {
          bkpProtocol = urlTest.protocol;
          urlTest.protocol = 'invalid';
        } );

        after( function() {
          urlTest.protocol = bkpProtocol;
        } );

        it( 'should return a 404 response', function() {
          index.__get__( 'utils' ).fourOhFour.reset();
          var result = index.__get__( 'processUrl' )( urlTest, {}, fakeResponse, { 'redirects': 3, 'transform': undefined, 'reqUrl': 'http://localhost/encoded-key/encoded-url' } );
          expect( index.__get__( 'utils' ).fourOhFour ).to.have.been.calledOnce;
          expect( index.__get__( 'utils' ).fourOhFour.getCall( 0 ).args[ 1 ] ).to.be.equal( 'Unknown protocol' );
          expect( result ).to.be.equal( 'return from fourOhFour' );
        } );        
      } );

      describe( 'with a VALID protocol', function() {
        describe( 'HTTP', function() {
          var bkpProtocol;

          before( function() {
            bkpProtocol = urlTest.protocol;
            urlTest.protocol = 'http:';
          } );

          after( function() {
            urlTest.protocol = bkpProtocol;
          } );

          it( 'should use the HTTP.get method', function() {
            index.__get__( 'Http' ).get.reset();
            index.__get__( 'Https' ).get.reset();
            index.__get__( 'processUrl' )( urlTest, {}, fakeResponse, { 'redirects': 3, 'transform': undefined, 'reqUrl': 'http://localhost/encoded-key/encoded-url' } );
            expect( index.__get__( 'Http' ).get ).to.have.been.calledOnce;
            expect( index.__get__( 'Https' ).get ).not.to.have.been.called;
          } );
        } );

        describe( 'HTTPS', function() {
          var bkpProtocol;

          before( function() {
            bkpProtocol = urlTest.protocol;
            urlTest.protocol = 'https:';
          } );

          after( function() {
            urlTest.protocol = bkpProtocol;
          } );

          it( 'should use the HTTPS.get method', function() {
            index.__get__( 'Https' ).get.reset();
            index.__get__( 'Http' ).get.reset();
            index.__get__( 'processUrl' )( urlTest, {}, fakeResponse, { 'redirects': 3, 'transform': undefined, 'reqUrl': 'http://localhost/encoded-key/encoded-url' } );
            expect( index.__get__( 'Https' ).get ).to.have.been.calledOnce;
            expect( index.__get__( 'Http' ).get ).not.to.have.been.called;
          } );
        } );

        describe.skip( 'when request takes too long', function() {
          var bkpSetTimeout,
              bkpSocketTimeout,
              clock;

          before( function() {
            bkpSocketTimeout = index.__get__( 'config' ).socketTimeout;
            index.__get__( 'config' ).socketTimeout = 5;

            bkpSetTimeout = fakeProtocol.setTimeout;
            // fakeProtocol.setTimeout = setTimeout;
            // console.log( typeof( setTimeout ) );
            console.log( index.__get__( 'config' ).socketTimeout );
          } );

          after( function() {
            index.__get__( 'config' ).socketTimeout = bkpSocketTimeout;
            fakeProtocol.setTimeout = bkpSetTimeout;
          } );

          beforeEach( function () {
            // clock = sinon.useFakeTimers();
          } );

          afterEach(function () {
            // clock.restore();
          } );

          it( 'should abort the request', function() {
            fakeProtocol.abort.reset();
            index.__get__( 'processUrl' )( urlTest, {}, fakeResponse, { 'redirects': 3, 'transform': undefined, 'reqUrl': 'http://localhost/encoded-key/encoded-url' } );
            // clock.tick( ( 5 * 1000 ) - 10 );
            // expect( fakeProtocol.abort ).not.to.have.been.called;
            // clock.tick( 20 );
            // expect( fakeProtocol.abort ).to.have.been.calledOnce;
          } );

          it( 'should return a 404', function() {
            // index.__get__( 'fourOhFour' ).reset();
            // var result = index.__get__( 'processUrl' )( urlTest, {}, fakeResponse, { 'redirects': 3, 'transform': undefined, 'reqUrl': 'http://localhost/encoded-key/encoded-url' } );
            // clock.tick( 5 * 1000 );
            // expect( index.__get__( 'fourOhFour' ) ).to.have.been.calledOnce;
            // expect( index.__get__( 'fourOhFour' ).getCall( 0 ).args[ 1 ] ).to.be.equal( 'Socket timeout' );
            // expect( result ).to.be.equal( 'return from fourOhFour' );
          } );
        } );

        describe( 'when request fails', function() {
          var errCallback;

          before( function() {
            fakeProtocol.on.reset();
            index.__get__( 'processUrl' )( urlTest, {}, fakeResponse, { 'redirects': 3, 'transform': undefined, 'reqUrl': 'http://localhost/encoded-key/encoded-url' } );
            errCallback = fakeProtocol.on.getCall( 0 ).args[ 1 ];
          } );

          it( 'should return a 404 response', function() {            
            index.__get__( 'utils' ).fourOhFour.reset();
            var result = errCallback( { stack: 'stack' } );
            expect( index.__get__( 'utils' ).fourOhFour ).to.have.been.calledOnce;
            expect( index.__get__( 'utils' ).fourOhFour.getCall( 0 ).args[ 1 ] ).to.be.equal( 'Media request error stack' );
            expect( result ).to.be.equal( 'return from fourOhFour' );
          } );
        } );

        describe( 'when response is aborted', function() {
          var closeCallback;

          before( function() {
            fakeResponse.on.reset();
            index.__get__( 'processUrl' )( urlTest, {}, fakeResponse, { 'redirects': 3, 'transform': undefined, 'reqUrl': 'http://localhost/encoded-key/encoded-url' } );
            closeCallback = fakeResponse.on.getCall( 0 );
            // this following is just to make sure I got the right call
            expect( closeCallback ).to.be.calledWith( 'close', sinon.match.func );
            closeCallback = closeCallback.args[ 1 ];
          } );

          it( 'should log an warn', function() {
            index.__get__( 'log' ).warn.reset();
            closeCallback();
            expect( index.__get__( 'log' ).warn ).to.have.been.calledOnce;
            expect( index.__get__( 'log' ).warn ).to.have.been.calledWith( 'Request aborted' );
          } );

          it( 'should abort the external request', function() {
            fakeProtocol.abort.reset();
            var result = closeCallback();
            expect( fakeProtocol.abort ).to.have.been.calledOnce;
            expect( result ).to.be.equal( 'request aborted' );
          } );
        } );

        describe( 'when response fails', function() {
          var errCallback;

          before( function() {
            fakeResponse.on.reset();
            index.__get__( 'processUrl' )( urlTest, {}, fakeResponse, { 'redirects': 3, 'transform': undefined, 'reqUrl': 'http://localhost/encoded-key/encoded-url' } );
            errCallback = fakeResponse.on.getCall( 1 );
            // this following is just to make sure I got the right call
            expect( errCallback ).to.be.calledWith( 'error', sinon.match.func );
            errCallback = errCallback.args[ 1 ];
          } );

          it( 'should log an error', function() {
            index.__get__( 'log' ).error.reset();
            errCallback( 'some error' );
            expect( index.__get__( 'log' ).error ).to.have.been.calledOnce;
            expect( index.__get__( 'log' ).error ).to.have.been.calledWith( 'Request error: some error' );
          } );

          describe( 'when a media request exist', function() {
            it( 'should abort the media request', function() {
              fakeProtocol.abort.reset();
              errCallback( 'some error' );
              expect( fakeProtocol.abort ).to.have.been.calledOnce;
            } );
          } );

          it( 'should finish the main response', function() {
            index.__get__( 'utils' ).finish.reset();
            errCallback( 'some error' );
            expect( index.__get__( 'utils' ).finish ).to.have.been.calledOnce;
          } );
        } );

        describe( 'external response callback', function() {
          var externalCallback,
              fakeExternalResponse,
              restoreProcessUrl;

          before( function() {
            index.__get__( 'Http' ).get.reset();
            index.__get__( 'processUrl' )( urlTest, {}, fakeResponse, { 'redirects': 3, 'transform': undefined, 'reqUrl': 'http://localhost/encoded-key/encoded-url' } );
            externalCallback = index.__get__( 'Http' ).get.getCall( 0 ).args[ 1 ];

            fakeExternalResponse = {
              'headers' : {
                'content-type': 'image/jpeg',
                'content-length': ( 2 * 1024 * 1024 ) + 1, // 2Mb + 1 byte
                'location': 'http://www.sample-domain.com/asset/path'
              },
              'destroy': sinon.stub(),
              'on': sinon.stub(),
              'statusCode': 200,
              'pipe': sinon.stub()
            };

            restoreProcessUrl = index.__set__( 'processUrl', sinon.stub() );
          } );

          after( function() {
            restoreProcessUrl();
          } );

          describe( 'when external response exceeded size limit', function() {
            var bkpLengthLimit;

            before( function() {
              bkpLengthLimit = index.__get__( 'config' ).lengthLimit;
              index.__get__( 'config' ).lengthLimit = 2 * 1024 * 1024; // 2mb
            } );

            after( function() {
              index.__get__( 'config' ).lengthLimit = bkpLengthLimit;
            } );

            it( 'should destroy the external response', function() {
              fakeExternalResponse.destroy.reset();
              externalCallback( fakeExternalResponse );
              expect( fakeExternalResponse.destroy ).to.have.been.calledOnce;
            } );

            it( 'should return a 404 response', function() {
              index.__get__( 'utils' ).fourOhFour.reset();
              var result = externalCallback( fakeExternalResponse );
              expect( index.__get__( 'utils' ).fourOhFour ).to.have.been.calledOnce;
              expect( index.__get__( 'utils' ).fourOhFour.getCall( 0 ).args[ 1 ] ).to.be.equal( 'Content-Length exceeded' );
              expect( result ).to.be.equal( 'return from fourOhFour' );
            } );
          } );

          describe( 'and external response DID NOT exceeded size limit', function() {

            describe( 'when external response ends', function() {
              var bkpFinish;

              before( function() {
                bkpFinish = index.__get__( 'utils' ).finish();
                index.__get__( 'utils' ).finish.returns( 'return finished' );
              } );

              after( function() {
                index.__get__( 'utils' ).finish.returns( bkpFinish );
              } );

              describe( 'and is flagged to finish', function() {
                var endCallback,
                    bkpStatusCode;

                before( function() {
                  fakeExternalResponse.on.reset();
                  bkpStatusCode = fakeExternalResponse.statusCode;

                  // 200 will keep the isFinish flag equal to true
                  fakeExternalResponse.statusCode = 200;

                  externalCallback( fakeExternalResponse );
                  endCallback = fakeExternalResponse.on.getCall( 0 );
                  // this following is just to make sure I got the right call
                  expect( endCallback ).to.be.calledWith( 'end', sinon.match.func );
                  endCallback = endCallback.args[ 1 ];
                } );

                after( function() {
                  fakeExternalResponse.statusCode = bkpStatusCode;
                } );

                it( 'should finish the response', function() {
                  index.__get__( 'utils' ).finish.reset();
                  endCallback()
                  expect( index.__get__( 'utils' ).finish ).to.have.been.calledOnce;
                } );
              } );

              describe( 'and is NOT flagged to finish', function() {
                var endCallback,
                    bkpStatusCode;

                before( function() {
                  fakeExternalResponse.on.reset();
                  bkpStatusCode = fakeExternalResponse.statusCode;

                  // 301 with a couple of other conditions will set isFinish to false
                  fakeExternalResponse.statusCode = 301;

                  externalCallback( fakeExternalResponse );
                  endCallback = fakeExternalResponse.on.getCall( 0 );
                  // this following is just to make sure I got the right call
                  expect( endCallback ).to.be.calledWith( 'end', sinon.match.func );
                  endCallback = endCallback.args[ 1 ];
                } );

                after( function() {
                  fakeExternalResponse.statusCode = bkpStatusCode;
                } );

                it( 'should NOT finish the response', function() {
                  index.__get__( 'utils' ).finish.reset();
                  endCallback()
                  expect( index.__get__( 'utils' ).finish ).not.to.have.been.called;
                } );
              } );
            } );

            describe( 'when external response fails', function() {
              var bkpFinish;

              before( function() {
                bkpFinish = index.__get__( 'utils' ).finish();
                index.__get__( 'utils' ).finish.returns( 'return finished' );
              } );

              after( function() {
                index.__get__( 'utils' ).finish.returns( bkpFinish );
              } );

              describe( 'and is flagged to finish', function() {
                var errCallback,
                    bkpStatusCode;

                before( function() {
                  fakeExternalResponse.on.reset();
                  bkpStatusCode = fakeExternalResponse.statusCode;

                  // 200 will keep the isFinish flag equal to true
                  fakeExternalResponse.statusCode = 200;

                  externalCallback( fakeExternalResponse );
                  errCallback = fakeExternalResponse.on.getCall( 1 );
                  // this following is just to make sure I got the right call
                  expect( errCallback ).to.be.calledWith( 'error', sinon.match.func );
                  errCallback = errCallback.args[ 1 ];
                } );

                after( function() {
                  fakeExternalResponse.statusCode = bkpStatusCode;
                } );

                it( 'should finish the response', function() {
                  index.__get__( 'utils' ).finish.reset();
                  errCallback()
                  expect( index.__get__( 'utils' ).finish ).to.have.been.calledOnce;
                } );
              } );

              describe( 'and is NOT flagged to finish', function() {
                var errCallback,
                    bkpStatusCode;

                before( function() {
                  fakeExternalResponse.on.reset();
                  bkpStatusCode = fakeExternalResponse.statusCode;

                  // 301 with a couple of other conditions will set isFinish to false
                  fakeExternalResponse.statusCode = 301;

                  externalCallback( fakeExternalResponse );
                  errCallback = fakeExternalResponse.on.getCall( 1 );
                  // this following is just to make sure I got the right call
                  expect( errCallback ).to.be.calledWith( 'error', sinon.match.func );
                  errCallback = errCallback.args[ 1 ];
                } );

                after( function() {
                  fakeExternalResponse.statusCode = bkpStatusCode;
                } );

                it( 'should NOT finish the response', function() {
                  index.__get__( 'utils' ).finish.reset();
                  errCallback()
                  expect( index.__get__( 'utils' ).finish ).not.to.have.been.called;
                } );
              } );
            } );

            describe( 'when etag is received from external', function() {
              var bkpEtag;

              before( function() {
                bkpEtag = fakeExternalResponse.headers.etag;
                fakeExternalResponse.headers.etag = 'etag value';
              } );

              after( function() {
                fakeExternalResponse.headers.etag = bkpEtag;
              } );

              it( 'should set etag to the response', function() {
                fakeResponse.writeHead.reset();
                externalCallback( fakeExternalResponse );
                expect( fakeResponse.writeHead ).to.have.been.calledOnce;
                expect( fakeResponse.writeHead.getCall( 0 ).args[ 1 ].etag ).to.be.equal( 'etag value' );
              } );
            } );

            describe( 'when expires is received from external', function() {
              var bkpExpires;

              before( function() {
                bkpExpires = fakeExternalResponse.headers.expires;
                fakeExternalResponse.headers.expires = 'expires value';
              } );

              after( function() {
                fakeExternalResponse.headers.expires = bkpExpires;
              } );

              it( 'should set expires to the response', function() {
                fakeResponse.writeHead.reset();
                externalCallback( fakeExternalResponse );
                expect( fakeResponse.writeHead ).to.have.been.calledOnce;
                expect( fakeResponse.writeHead.getCall( 0 ).args[ 1 ].expires ).to.be.equal( 'expires value' );
              } );
            } );

            describe( 'when last-modified is received from external', function() {
              var bkpLastModified;

              before( function() {
                bkpLastModified = fakeExternalResponse.headers[ 'last-modified' ];
                fakeExternalResponse.headers[ 'last-modified' ] = 'last-modified value';
              } );

              after( function() {
                fakeExternalResponse.headers[ 'last-modified' ] = bkpLastModified;
              } );

              it( 'should set last-modified to the response', function() {
                fakeResponse.writeHead.reset();
                externalCallback( fakeExternalResponse );
                expect( fakeResponse.writeHead ).to.have.been.calledOnce;
                expect( fakeResponse.writeHead.getCall( 0 ).args[ 1 ][ 'last-modified' ] ).to.be.equal( 'last-modified value' );
              } );
            } );

            describe( 'when timingOrigin config is defined', function() {
              var bkpTimingOrigin;

              before( function() {
                bkpTimingOrigin = index.__get__( 'config' ).timingOrigin;
                index.__get__( 'config' ).timingOrigin = 'timingOrigin value';
              } );

              after( function() {
                index.__get__( 'config' ).timingOrigin = bkpTimingOrigin;
              } );

              it( 'should set Timing-Allow-Origin to the response', function() {
                fakeResponse.writeHead.reset();
                externalCallback( fakeExternalResponse );
                expect( fakeResponse.writeHead ).to.have.been.calledOnce;
                expect( fakeResponse.writeHead.getCall( 0 ).args[ 1 ][ 'Timing-Allow-Origin' ] ).to.be.equal( 'timingOrigin value' );
              } );
            } );

            describe( 'when content-length is received from external', function() {
              var bkpContentLength;

              before( function() {
                bkpContentLength = fakeExternalResponse.headers[ 'content-length' ];
                fakeExternalResponse.headers[ 'content-length' ] = 'content-length value';
              } );

              after( function() {
                fakeExternalResponse.headers[ 'content-length' ] = bkpContentLength;
              } );

              it( 'should set content-length to the response', function() {
                fakeResponse.writeHead.reset();
                externalCallback( fakeExternalResponse );
                expect( fakeResponse.writeHead ).to.have.been.calledOnce;
                expect( fakeResponse.writeHead.getCall( 0 ).args[ 1 ][ 'content-length' ] ).to.be.equal( 'content-length value' );
              } );
            } );

            describe( 'when transfer-encoding is received from external', function() {
              var bkpTransferEncoding;

              before( function() {
                bkpTransferEncoding = fakeExternalResponse.headers[ 'transfer-encoding' ];
                fakeExternalResponse.headers[ 'transfer-encoding' ] = 'transfer-encoding value';
              } );

              after( function() {
                fakeExternalResponse.headers[ 'transfer-encoding' ] = bkpTransferEncoding;
              } );

              it( 'should set transfer-encoding to the response', function() {
                fakeResponse.writeHead.reset();
                externalCallback( fakeExternalResponse );
                expect( fakeResponse.writeHead ).to.have.been.calledOnce;
                expect( fakeResponse.writeHead.getCall( 0 ).args[ 1 ][ 'transfer-encoding' ] ).to.be.equal( 'transfer-encoding value' );
              } );
            } );

            describe( 'when content-encoding is received from external', function() {
              var bkpContentEncoding;

              before( function() {
                bkpContentEncoding = fakeExternalResponse.headers[ 'content-encoding' ];
                fakeExternalResponse.headers[ 'content-encoding' ] = 'content-encoding value';
              } );

              after( function() {
                fakeExternalResponse.headers[ 'content-encoding' ] = bkpContentEncoding;
              } );

              it( 'should set content-encoding to the response', function() {
                fakeResponse.writeHead.reset();
                externalCallback( fakeExternalResponse );
                expect( fakeResponse.writeHead ).to.have.been.calledOnce;
                expect( fakeResponse.writeHead.getCall( 0 ).args[ 1 ][ 'content-encoding' ] ).to.be.equal( 'content-encoding value' );
              } );
            } );

            describe( 'when external response gets a redirect', function() {
              var bkpStatusCode;
              before( function() {
                bkpStatusCode = fakeExternalResponse.statusCode;
                fakeExternalResponse.statusCode = 301; // todo: verify if i have to test: 302/303/307/308
              } );

              after( function() {
                fakeExternalResponse.statusCode = bkpStatusCode;
              } );

              it( 'should destroy the external response', function() {
                fakeExternalResponse.destroy.reset();
                externalCallback( fakeExternalResponse );
                expect( fakeExternalResponse.destroy ).to.have.been.calledOnce;
              } );

              describe( 'when maximum redirects was reached', function() {
                var externalCallback2;

                before( function() {
                  restoreProcessUrl();
                  index.__get__( 'Http' ).get.reset();
                  index.__get__( 'processUrl' )( urlTest, {}, fakeResponse, 0 );
                  externalCallback2 = index.__get__( 'Http' ).get.getCall( 0 ).args[ 1 ];
                  restoreProcessUrl = index.__set__( 'processUrl', sinon.stub() );
                } );

                it( 'should return a 404 response', function() {
                  index.__get__( 'utils' ).fourOhFour.reset();
                  externalCallback2( fakeExternalResponse );
                  expect( index.__get__( 'utils' ).fourOhFour ).to.have.been.calledOnce;
                  expect( index.__get__( 'utils' ).fourOhFour.getCall( 0 ).args[ 1 ] ).to.be.equal( 'Exceeded max depth' );
                } );
              } );

              describe( 'when the redirect response does NOT contain a location', function() {
                var bkpLocation;

                before( function() {
                  bkpLocation = fakeExternalResponse.headers.location;
                  fakeExternalResponse.headers.location = void 0;
                } );

                after( function() {
                  fakeExternalResponse.headers.location = bkpLocation;
                } );

                it( 'should return a 404 response', function() {
                  index.__get__( 'utils' ).fourOhFour.reset();
                  externalCallback( fakeExternalResponse );
                  expect( index.__get__( 'utils' ).fourOhFour ).to.have.been.calledOnce;
                  expect( index.__get__( 'utils' ).fourOhFour.getCall( 0 ).args[ 1 ] ).to.be.equal( 'Redirect with no location' );
                } );
              } );

              describe( 'when maximum redirects was NOT reached and it contains a location', function() {
                var bkpLocation;

                before( function() {
                  // maximum is set to 3 based on the startup of the parent
                  bkpLocation = fakeExternalResponse.headers.location;
                  fakeExternalResponse.headers.location = 'http://new-domain.com/some/path';
                } );

                after( function() {
                  fakeExternalResponse.headers.location = bkpLocation;
                } );

                describe( 'when the location does NOT have a host', function() {
                  var bkpParse;

                  before( function() {
                    bkpParse = index.__get__( 'Url' ).parse();
                    index.__get__( 'Url' ).parse.returns( {
                      'protocol': 'http:',
                      'port': 80,
                      'format': function(){}
                    } );
                  } );

                  after( function() {
                    index.__get__( 'Url' ).parse.returns( bkpParse );
                  } );

                  it( 'should use the host of the current external request', function() {
                    index.__get__( 'processUrl' ).reset();
                    externalCallback( fakeExternalResponse );
                    expect( index.__get__( 'processUrl' ) ).to.have.been.calledOnce;
                    expect( index.__get__( 'processUrl' ).getCall( 0 ).args[ 0 ].host ).to.be.equal( 'www.some-domain.com' );
                  } );
                } );

                describe( 'when the location does have a host', function() {
                  var bkpParse;

                  before( function() {
                    bkpParse = index.__get__( 'Url' ).parse();
                    index.__get__( 'Url' ).parse.returns( {
                      'host': 'new-domain.com',
                      'hostname': 'new-domain.com',
                      'protocol': 'http:',
                      'port': 80,
                      'format': function(){}
                    } );
                  } );

                  after( function() {
                    index.__get__( 'Url' ).parse.returns( bkpParse );
                  } );

                  it( 'should use received host', function() {
                    index.__get__( 'processUrl' ).reset();
                    externalCallback( fakeExternalResponse );
                    expect( index.__get__( 'processUrl' ) ).to.have.been.calledOnce;
                    expect( index.__get__( 'processUrl' ).getCall( 0 ).args[ 0 ].host ).to.be.equal( 'new-domain.com' );
                  } );
                } );

                it( 'should request the new location', function() {
                  index.__get__( 'processUrl' ).reset();
                  externalCallback( fakeExternalResponse );
                  expect( index.__get__( 'processUrl' ) ).to.have.been.calledOnce;
                  expect( index.__get__( 'processUrl' ).getCall( 0 ).args[ 3 ].redirects ).to.be.equal( 2 );
                } );
              } );
            } );

            describe( 'when external response gets a not modified', function() {
              var bkpStatusCode;

              before( function() {
                bkpStatusCode = fakeExternalResponse.statusCode;
                fakeExternalResponse.statusCode = 304;
              } );

              after( function() {
                fakeExternalResponse.statusCode = bkpStatusCode;
              } );

              it( 'should destroy the current external response', function() {
                fakeExternalResponse.destroy.reset();
                externalCallback( fakeExternalResponse );
                expect( fakeExternalResponse.destroy ).to.have.been.calledOnce;
              } );

              it( 'should send back a not modified response', function() {
                fakeResponse.writeHead.reset();
                externalCallback( fakeExternalResponse );
                expect( fakeResponse.writeHead ).to.have.been.calledOnce;
                expect( fakeResponse.writeHead.getCall( 0 ).args[ 0 ] ).to.be.equal( 304 );
              } );
            } );

            describe( 'when external response is not a redirect and is fresh', function() {
              var bkpStatusCode;

              before( function() {
                bkpStatusCode = fakeExternalResponse.statusCode;
                fakeExternalResponse.statusCode = 200;
              } );

              after( function() {
                fakeExternalResponse.statusCode = bkpStatusCode;
              } );

              describe( 'and NO content-type was sent', function() {
                var bkpContentType;

                before( function() {
                  bkpContentType = fakeExternalResponse.headers[ 'content-type' ];
                  fakeExternalResponse.headers[ 'content-type' ] = void 0;
                } );

                after( function() {
                  fakeExternalResponse.headers[ 'content-type' ] = bkpContentType;
                } );

                it( 'should destroy the external response', function() {
                  fakeExternalResponse.destroy.reset();
                  externalCallback( fakeExternalResponse );
                  expect( fakeExternalResponse.destroy ).to.have.been.calledOnce;
                } );

                it( 'should return a 404 response', function() {
                  index.__get__( 'utils' ).fourOhFour.reset();
                  var result = externalCallback( fakeExternalResponse );
                  expect( index.__get__( 'utils' ).fourOhFour ).to.have.been.calledOnce;
                  expect( index.__get__( 'utils' ).fourOhFour.getCall( 0 ).args[ 1 ] ).to.be.equal( 'No content-type returned' );
                } );
              } );

              describe( 'when the content-type is not a valid media type', function() {
                var bkpContentType;

                before( function() {
                  bkpContentType = fakeExternalResponse.headers[ 'content-type' ];
                  fakeExternalResponse.headers[ 'content-type' ] = 'invalid/type';
                } );

                after( function() {
                  fakeExternalResponse.headers[ 'content-type' ] = bkpContentType;
                } );

                it( 'should destroy the external response', function() {
                  fakeExternalResponse.destroy.reset();
                  externalCallback( fakeExternalResponse );
                  expect( fakeExternalResponse.destroy ).to.have.been.calledOnce;
                } );

                it( 'should return a 404 response', function() {
                  index.__get__( 'utils' ).fourOhFour.reset();
                  externalCallback( fakeExternalResponse );
                  expect( index.__get__( 'utils' ).fourOhFour ).to.have.been.calledOnce;
                  expect( index.__get__( 'utils' ).fourOhFour.getCall( 0 ).args[ 1 ] ).to.be.equal( 'Non-Image content-type returned \'invalid/type\'' );
                } );
              } );

              describe( 'when content-type defined and valid', function() {
                var bkpContentType;

                before( function() {
                  bkpContentType = fakeExternalResponse.headers[ 'content-type' ];
                  fakeExternalResponse.headers[ 'content-type' ] = 'image/png';
                } );

                after( function() {
                  fakeExternalResponse.headers[ 'content-type' ] = bkpContentType;
                } );

                it( 'should write the main response', function() {
                  fakeResponse.writeHead.reset();
                  externalCallback( fakeExternalResponse );
                  expect( fakeResponse.writeHead ).to.have.been.calledOnce;
                  expect( fakeResponse.writeHead.getCall( 0 ).args[ 0 ] ).to.be.equal( 200 );
                  expect( fakeResponse.writeHead.getCall( 0 ).args[ 1 ][ 'content-type' ] ).to.be.equal( 'image/png' );
                } );

                it( 'should make sure the external response finishes before the main response', function() {
                  fakeExternalResponse.pipe.reset();
                  externalCallback( fakeExternalResponse );
                  expect( fakeExternalResponse.pipe ).to.have.been.calledOnce;
                  expect( fakeExternalResponse.pipe.getCall( 0 ).args[ 0 ] ).to.be.equal( fakeResponse );
                } );

              } );
            } );
          } );

        } );

      } );

    } );
  } );
} );