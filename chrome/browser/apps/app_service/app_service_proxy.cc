// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/apps/app_service/app_service_proxy.h"

#include <utility>

#include "chrome/browser/apps/app_service/app_service_proxy_factory.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/services/app_service/public/mojom/constants.mojom.h"
#include "content/public/browser/browser_context.h"
#include "mojo/public/cpp/bindings/interface_request.h"
#include "services/service_manager/public/cpp/connector.h"

namespace apps {

// static
AppServiceProxy* AppServiceProxy::Get(Profile* profile) {
  return AppServiceProxyFactory::GetForProfile(profile);
}

AppServiceProxy::AppServiceProxy(Profile* profile) {
  content::BrowserContext::GetConnectorFor(profile)->BindInterface(
      apps::mojom::kServiceName, mojo::MakeRequest(&app_service_));

  // The AppServiceProxy is a subscriber: something that wants to be able to
  // list all known apps.
  apps::mojom::SubscriberPtr subscriber;
  bindings_.AddBinding(this, mojo::MakeRequest(&subscriber));
  app_service_->RegisterSubscriber(std::move(subscriber), nullptr);

#if defined(OS_CHROMEOS)
  // The AppServiceProxy is also a publisher, of built-in apps. That
  // responsibility isn't intrinsically part of the AppServiceProxy, but doing
  // that here is as good a place as any.
  built_in_chrome_os_apps_.Register(app_service_);
#endif  // OS_CHROMEOS
}

AppServiceProxy::~AppServiceProxy() = default;

AppRegistryCache& AppServiceProxy::Cache() {
  return cache_;
}

void AppServiceProxy::OnApps(std::vector<apps::mojom::AppPtr> deltas) {
  cache_.OnApps(std::move(deltas));
}

void AppServiceProxy::Clone(apps::mojom::SubscriberRequest request) {
  bindings_.AddBinding(this, std::move(request));
}

}  // namespace apps
