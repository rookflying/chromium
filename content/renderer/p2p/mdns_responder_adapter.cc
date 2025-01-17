// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "content/renderer/p2p/mdns_responder_adapter.h"

#include <string>

#include "base/bind.h"
#include "content/child/child_thread_impl.h"
#include "content/public/common/service_names.mojom.h"
#include "jingle/glue/utils.h"
#include "net/base/ip_address.h"
#include "net/base/ip_endpoint.h"
#include "services/service_manager/public/cpp/connector.h"
#include "third_party/webrtc/rtc_base/ipaddress.h"

namespace content {

namespace {

void OnNameCreatedForAddress(
    webrtc::MdnsResponderInterface::NameCreatedCallback callback,
    const rtc::IPAddress& addr,
    const std::string& name,
    bool announcement_scheduled) {
  // We currently ignore whether there is an announcement sent for the name.
  callback(addr, name);
}

void OnNameRemovedForAddress(
    webrtc::MdnsResponderInterface::NameRemovedCallback callback,
    bool removed,
    bool goodbye_scheduled) {
  // We currently ignore whether there is a goodbye sent for the name.
  callback(removed);
}

}  // namespace

MdnsResponderAdapter::MdnsResponderAdapter() {
  ChildThreadImpl::current()->GetConnector()->BindInterface(
      mojom::kBrowserServiceName, mojo::MakeRequest(&client_));
}

MdnsResponderAdapter::~MdnsResponderAdapter() = default;

void MdnsResponderAdapter::CreateNameForAddress(const rtc::IPAddress& addr,
                                                NameCreatedCallback callback) {
  client_->CreateNameForAddress(
      jingle_glue::RtcIPAddressToNetIPAddress(addr),
      base::BindOnce(&OnNameCreatedForAddress, callback, addr));
}

void MdnsResponderAdapter::RemoveNameForAddress(const rtc::IPAddress& addr,
                                                NameRemovedCallback callback) {
  client_->RemoveNameForAddress(
      jingle_glue::RtcIPAddressToNetIPAddress(addr),
      base::BindOnce(&OnNameRemovedForAddress, callback));
}

}  // namespace content
