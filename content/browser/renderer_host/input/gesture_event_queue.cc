// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "content/browser/renderer_host/input/gesture_event_queue.h"

#include "base/auto_reset.h"
#include "base/trace_event/trace_event.h"
#include "content/browser/renderer_host/input/touchpad_tap_suppression_controller.h"
#include "content/browser/renderer_host/input/touchscreen_tap_suppression_controller.h"
#include "ui/events/blink/blink_features.h"
#include "ui/events/blink/web_input_event_traits.h"

using blink::WebGestureEvent;
using blink::WebInputEvent;

namespace content {

GestureEventQueue::GestureEventWithLatencyInfoAndAckState::
    GestureEventWithLatencyInfoAndAckState(
        const GestureEventWithLatencyInfo& event)
    : GestureEventWithLatencyInfo(event) {}

GestureEventQueue::Config::Config() {
}

GestureEventQueue::GestureEventQueue(
    GestureEventQueueClient* client,
    FlingControllerEventSenderClient* fling_event_sender_client,
    FlingControllerSchedulerClient* fling_scheduler_client,
    const Config& config)
    : client_(client),
      scrolling_in_progress_(false),
      debounce_interval_(config.debounce_interval),
      fling_controller_(fling_event_sender_client,
                        fling_scheduler_client,
                        config.fling_config) {
  DCHECK(client);
  DCHECK(fling_event_sender_client);
  DCHECK(fling_scheduler_client);
}

GestureEventQueue::~GestureEventQueue() { }

bool GestureEventQueue::DebounceOrForwardEvent(
    const GestureEventWithLatencyInfo& gesture_event) {
  // GFS and GFC should have been filtered in FlingControllerFilterEvent.
  DCHECK_NE(gesture_event.event.GetType(), WebInputEvent::kGestureFlingStart);
  DCHECK_NE(gesture_event.event.GetType(), WebInputEvent::kGestureFlingCancel);
  if (!ShouldForwardForBounceReduction(gesture_event))
    return false;

  ForwardGestureEvent(gesture_event);
  return true;
}

bool GestureEventQueue::FlingControllerFilterEvent(
    const GestureEventWithLatencyInfo& gesture_event) {
  TRACE_EVENT0("input", "GestureEventQueue::QueueEvent");
  if (fling_controller_.FilterGestureEvent(gesture_event))
    return true;

  // fling_controller_ is in charge of handling GFS events and the events are
  // not sent to the renderer, the controller processes the fling and generates
  // fling progress events (wheel events for touchpad and GSU events for
  // touchscreen and autoscroll) which are handled normally.
  if (gesture_event.event.GetType() == WebInputEvent::kGestureFlingStart) {
    fling_controller_.ProcessGestureFlingStart(gesture_event);
    return true;
  }

  // If the GestureFlingStart event is processed by the fling_controller_, the
  // GestureFlingCancel event should be the same.
  if (gesture_event.event.GetType() == WebInputEvent::kGestureFlingCancel) {
    fling_controller_.ProcessGestureFlingCancel(gesture_event);
    return true;
  }

  return false;
}

void GestureEventQueue::QueueDeferredEvents(
    const GestureEventWithLatencyInfo& gesture_event) {
  deferred_gesture_queue_.push_back(gesture_event);
}

GestureEventQueue::GestureQueue GestureEventQueue::TakeDeferredEvents() {
  GestureQueue deferred_gesture_events;
  deferred_gesture_events.swap(deferred_gesture_queue_);
  return deferred_gesture_events;
}

void GestureEventQueue::StopFling() {
  fling_controller_.StopFling();
}

bool GestureEventQueue::FlingCancellationIsDeferred() const {
  return fling_controller_.FlingCancellationIsDeferred();
}

gfx::Vector2dF GestureEventQueue::CurrentFlingVelocity() const {
  return fling_controller_.CurrentFlingVelocity();
}

bool GestureEventQueue::FlingInProgressForTest() const {
  return fling_controller_.fling_in_progress();
}

bool GestureEventQueue::ShouldForwardForBounceReduction(
    const GestureEventWithLatencyInfo& gesture_event) {
  if (debounce_interval_ <= base::TimeDelta())
    return true;

  // Don't debounce any gesture events while a fling is in progress on the
  // browser side. A GSE event in this case ends fling progress and it shouldn't
  // get cancelled by its next GSB event.
  if (fling_controller_.fling_in_progress())
    return true;

  switch (gesture_event.event.GetType()) {
    case WebInputEvent::kGestureScrollUpdate:
      if (!scrolling_in_progress_) {
        debounce_deferring_timer_.Start(
            FROM_HERE,
            debounce_interval_,
            this,
            &GestureEventQueue::SendScrollEndingEventsNow);
      } else {
        // Extend the bounce interval.
        debounce_deferring_timer_.Reset();
      }
      scrolling_in_progress_ = true;
      debouncing_deferral_queue_.clear();
      return true;

    case WebInputEvent::kGesturePinchBegin:
    case WebInputEvent::kGesturePinchEnd:
    case WebInputEvent::kGesturePinchUpdate:
      return true;
    default:
      if (scrolling_in_progress_) {
        debouncing_deferral_queue_.push_back(gesture_event);
        return false;
      }
      return true;
  }
}

void GestureEventQueue::ForwardGestureEvent(
    const GestureEventWithLatencyInfo& gesture_event) {
  // GFS and GFC should have been filtered in FlingControllerFilterEvent to
  // get handled by fling controller.
  DCHECK_NE(gesture_event.event.GetType(), WebInputEvent::kGestureFlingStart);
  DCHECK_NE(gesture_event.event.GetType(), WebInputEvent::kGestureFlingCancel);
  sent_events_awaiting_ack_.push_back(gesture_event);
  if (gesture_event.event.GetType() == WebInputEvent::kGestureScrollBegin) {
    fling_controller_.RegisterFlingSchedulerObserver();
  } else if (gesture_event.event.GetType() ==
             WebInputEvent::kGestureScrollEnd) {
    fling_controller_.UnregisterFlingSchedulerObserver();
  }
  client_->SendGestureEventImmediately(gesture_event);
}

void GestureEventQueue::ProcessGestureAck(InputEventAckSource ack_source,
                                          InputEventAckState ack_result,
                                          WebInputEvent::Type type,
                                          const ui::LatencyInfo& latency) {
  TRACE_EVENT0("input", "GestureEventQueue::ProcessGestureAck");

  if (sent_events_awaiting_ack_.empty()) {
    DLOG(ERROR) << "Received unexpected ACK for event type " << type;
    return;
  }

  // ACKs could come back out of order. We want to cache them to restore the
  // original order.
  for (auto& outstanding_event : sent_events_awaiting_ack_) {
    if (outstanding_event.ack_state() != INPUT_EVENT_ACK_STATE_UNKNOWN)
      continue;
    if (outstanding_event.event.GetType() == type) {
      outstanding_event.latency.AddNewLatencyFrom(latency);
      outstanding_event.set_ack_info(ack_source, ack_result);
      break;
    }
  }

  AckCompletedEvents();
}

void GestureEventQueue::AckCompletedEvents() {
  // Don't allow re-entrancy into this method otherwise
  // the ordering of acks won't be preserved.
  if (processing_acks_)
    return;
  base::AutoReset<bool> process_acks(&processing_acks_, true);
  while (!sent_events_awaiting_ack_.empty()) {
    auto iter = sent_events_awaiting_ack_.begin();
    if (iter->ack_state() == INPUT_EVENT_ACK_STATE_UNKNOWN)
      break;
    GestureEventWithLatencyInfoAndAckState event = *iter;
    sent_events_awaiting_ack_.erase(iter);
    AckGestureEventToClient(event, event.ack_source(), event.ack_state());
  }
}

void GestureEventQueue::AckGestureEventToClient(
    const GestureEventWithLatencyInfo& event_with_latency,
    InputEventAckSource ack_source,
    InputEventAckState ack_result) {
  client_->OnGestureEventAck(event_with_latency, ack_source, ack_result);
}

TouchpadTapSuppressionController*
    GestureEventQueue::GetTouchpadTapSuppressionController() {
  return fling_controller_.GetTouchpadTapSuppressionController();
}

void GestureEventQueue::SendScrollEndingEventsNow() {
  scrolling_in_progress_ = false;
  if (debouncing_deferral_queue_.empty())
    return;
  GestureQueue debouncing_deferral_queue;
  debouncing_deferral_queue.swap(debouncing_deferral_queue_);
  for (GestureQueue::const_iterator it = debouncing_deferral_queue.begin();
       it != debouncing_deferral_queue.end(); it++) {
    if (!fling_controller_.FilterGestureEvent(*it)) {
      ForwardGestureEvent(*it);
    }
  }
}

}  // namespace content
