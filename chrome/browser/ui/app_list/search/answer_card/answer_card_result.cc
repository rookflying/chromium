// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/app_list/search/answer_card/answer_card_result.h"

#include "chrome/browser/ui/app_list/app_list_controller_delegate.h"
#include "chrome/browser/ui/app_list/search/search_util.h"

namespace app_list {

AnswerCardResult::AnswerCardResult(Profile* profile,
                                   AppListControllerDelegate* list_controller,
                                   const GURL& potential_card_url,
                                   const GURL& search_result_url,
                                   const GURL& stripped_search_result_url)
    : profile_(profile), list_controller_(list_controller) {
  DCHECK(!stripped_search_result_url.is_empty());
  SetDisplayType(ash::SearchResultDisplayType::kCard);
  SetResultType(ash::SearchResultType::kAnswerCard);
  SetQueryUrl(potential_card_url);
  set_id(search_result_url.spec());
  set_comparable_id(stripped_search_result_url.spec());
  set_relevance(1);
}

AnswerCardResult::~AnswerCardResult() = default;

void AnswerCardResult::Open(int event_flags) {
  list_controller_->OpenURL(profile_, GURL(id()), ui::PAGE_TRANSITION_GENERATED,
                            ui::DispositionFromEventFlags(event_flags));
  RecordHistogram(ANSWER_CARD);
}

}  // namespace app_list
