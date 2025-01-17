// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#import "ios/chrome/test/fakes/fake_url_loader.h"

#import "ios/chrome/browser/ui/commands/open_new_tab_command.h"

#if !defined(__has_feature) || !__has_feature(objc_arc)
#error "This file requires ARC support."
#endif

@interface FakeURLLoader () {
  GURL _url;
  web::Referrer _referrer;
}

@property(nonatomic) ui::PageTransition transition;
@property(nonatomic) BOOL rendererInitiated;
@property(nonatomic) BOOL inIncognito;
@property(nonatomic, copy) NSDictionary* extraHeaders;
@end

@implementation FakeURLLoader

@synthesize transition = _transition;
@synthesize rendererInitiated = _rendererInitiated;
@synthesize inIncognito = _inIncognito;
@synthesize extraHeaders = _extraHeaders;

- (void)loadURLWithParams:(const ChromeLoadParams&)chromeParams {
  web::NavigationManager::WebLoadParams params = chromeParams.web_params;
  _url = params.url;
  _referrer = params.referrer;
  self.transition = params.transition_type;
  self.rendererInitiated = params.is_renderer_initiated;
  self.extraHeaders = params.extra_headers;
}

- (void)webPageOrderedOpen:(OpenNewTabCommand*)command {
  _url = command.URL;
  _referrer = command.referrer;
  self.inIncognito = command.inIncognito;
}

- (void)loadSessionTab:(const sessions::SessionTab*)sessionTab {
}

- (void)restoreTabWithSessionID:(const SessionID)sessionID {
}

- (void)loadJavaScriptFromLocationBar:(NSString*)script {
}

- (const GURL&)url {
  return _url;
}

- (const web::Referrer&)referrer {
  return _referrer;
}

@end
