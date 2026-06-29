// Privacy Policy + Terms of Service content, kept out of the locale files
// (which are flat string maps) because these are long structured documents.
// Each entry is an array of sections { h, p } rendered by Privacy/Terms.jsx.
// Keep all three languages in sync — same sections, same order.
//
// Effective date is shown verbatim; bump it whenever the substance changes.
export const LEGAL_EFFECTIVE = '2026-06-28';
export const LEGAL_CONTACT = 'hello@uhzlab.com';

export const PRIVACY = {
  en: [
    { p: `This Privacy Policy explains what information drape ("we", "the app") collects, how we use it, and the choices you have. By using drape you agree to the practices described here.` },
    { h: 'Information you provide', p: `Account details from your sign-in provider (Apple or Google): your name, email, and profile photo. Photos you upload — clothing items, outfit and OOTD photos, and the identity (face/body) reference photos used for virtual try-on. Any text you add: item names, notes, captions, comments, and marketplace listings.` },
    { h: 'How your data is used', p: `Your photos are processed to build your closet (automatic background-removal and tagging) and to generate virtual try-on images. This processing uses third-party AI models from Google (Gemini). Your closet, identity photos, and OOTD entries are private to your account by default. Content becomes visible to others only when you choose to publish it to the feed, post a board, or list an item for sale.` },
    { h: 'Identity (face/body) photos', p: `Reference photos you add for try-on are used solely to preserve your likeness in generated images. They are stored privately, are never shown in the public feed, and are not used to train any model. You can delete them at any time from Settings.` },
    { h: 'Storage and processing', p: `Data is stored with Google Firebase (Authentication, Firestore, Cloud Storage) and processed on Google Cloud. Images are served over encrypted connections. We retain your data for as long as your account exists.` },
    { h: 'Analytics', p: `We use Google Firebase Analytics to understand how the app is used — for example which screens are viewed and how features perform — so we can improve drape. This is usage and device data tied to an app-generated identifier; it does not include your closet or identity photos. You can limit it through your device's privacy settings.` },
    { h: 'Sharing', p: `We do not sell your personal data. Content you publish (public outfits, boards, marketplace listings, comments, your handle and profile photo) is visible to other users. We share data with infrastructure providers (Google Firebase / Google Cloud, and the Gemini API) strictly to operate the app.` },
    { h: 'Your choices', p: `You can edit or delete individual items, outfits, boards, and identity photos at any time. You can delete your entire account, which removes your content. Reminder notifications can be turned off in Settings, and push can be disabled in your device settings.` },
    { h: 'Children', p: `drape is not directed to children under 13 (or the minimum age required in your country). We do not knowingly collect data from them.` },
    { h: 'Changes', p: `We may update this policy; material changes will be reflected by a new effective date. Continued use after an update means you accept the revised policy.` },
    { h: 'Contact', p: `Questions about privacy: ${LEGAL_CONTACT}` },
  ],
  ko: [
    { p: `본 개인정보 처리방침은 drape("당사", "앱")가 어떤 정보를 수집하고 어떻게 사용하는지, 그리고 이용자의 선택권을 설명합니다. drape를 사용함으로써 여기에 기술된 내용에 동의하는 것으로 간주됩니다.` },
    { h: '수집하는 정보', p: `로그인 제공자(Apple 또는 Google)로부터 받는 계정 정보: 이름, 이메일, 프로필 사진. 이용자가 업로드하는 사진 — 의류 아이템, 코디·OOTD 사진, 가상 피팅에 사용되는 정체성(얼굴/신체) 참조 사진. 이용자가 입력하는 텍스트: 아이템 이름, 메모, 캡션, 댓글, 마켓플레이스 게시글.` },
    { h: '정보 이용 방식', p: `업로드한 사진은 옷장 구성(자동 배경 제거 및 태깅)과 가상 피팅 이미지 생성을 위해 처리됩니다. 이 처리에는 Google의 제3자 AI 모델(Gemini)이 사용됩니다. 옷장, 정체성 사진, OOTD 기록은 기본적으로 비공개입니다. 콘텐츠는 이용자가 피드에 공개하거나, 보드를 게시하거나, 아이템을 판매 등록할 때만 타인에게 보입니다.` },
    { h: '정체성(얼굴/신체) 사진', p: `피팅을 위해 추가한 참조 사진은 오직 생성 이미지에서 본인의 모습을 유지하는 데만 사용됩니다. 비공개로 저장되며, 공개 피드에 절대 노출되지 않고, 어떤 모델 학습에도 사용되지 않습니다. 설정에서 언제든 삭제할 수 있습니다.` },
    { h: '저장 및 처리', p: `데이터는 Google Firebase(인증, Firestore, Cloud Storage)에 저장되고 Google Cloud에서 처리됩니다. 이미지는 암호화된 연결로 전송됩니다. 계정이 존재하는 동안 데이터를 보관합니다.` },
    { h: '분석', p: `당사는 앱이 어떻게 사용되는지(예: 어떤 화면을 보는지, 기능이 어떻게 작동하는지)를 파악해 drape를 개선하기 위해 Google Firebase Analytics를 사용합니다. 이는 앱이 생성한 식별자에 연결된 사용·기기 데이터이며, 옷장이나 정체성 사진은 포함하지 않습니다. 기기의 개인정보 설정에서 제한할 수 있습니다.` },
    { h: '공유', p: `당사는 이용자의 개인정보를 판매하지 않습니다. 이용자가 공개한 콘텐츠(공개 코디, 보드, 마켓 게시글, 댓글, 핸들과 프로필 사진)는 다른 이용자에게 보입니다. 앱 운영을 위해 인프라 제공자(Google Firebase / Google Cloud, Gemini API)에만 데이터를 전달합니다.` },
    { h: '이용자의 선택권', p: `개별 아이템, 코디, 보드, 정체성 사진을 언제든 수정·삭제할 수 있습니다. 계정 전체를 삭제하면 콘텐츠도 함께 제거됩니다. 리마인드 알림은 설정에서 끌 수 있고, 푸시는 기기 설정에서도 끌 수 있습니다.` },
    { h: '아동', p: `drape는 만 13세 미만(또는 거주 국가의 최소 연령 미만) 아동을 대상으로 하지 않으며, 해당 정보를 고의로 수집하지 않습니다.` },
    { h: '변경', p: `본 방침은 변경될 수 있으며, 중요한 변경은 새로운 시행일로 표시됩니다. 변경 후 계속 사용하면 개정된 방침에 동의하는 것으로 간주됩니다.` },
    { h: '문의', p: `개인정보 관련 문의: ${LEGAL_CONTACT}` },
  ],
  ja: [
    { p: `本プライバシーポリシーは、drape（「当社」「本アプリ」）が収集する情報、その利用方法、およびユーザーの選択肢について説明します。drape を利用することで、ここに記載された取り扱いに同意したものとみなされます。` },
    { h: '収集する情報', p: `サインインプロバイダ（Apple または Google）から取得するアカウント情報：氏名、メールアドレス、プロフィール写真。ユーザーがアップロードする写真 — 衣類アイテム、コーデ・OOTD 写真、バーチャル試着に使用するアイデンティティ（顔・身体）参照写真。ユーザーが入力するテキスト：アイテム名、メモ、キャプション、コメント、マーケットプレイスの出品。` },
    { h: 'データの利用方法', p: `アップロードされた写真は、クローゼットの構築（自動背景除去とタグ付け）およびバーチャル試着画像の生成のために処理されます。この処理には Google の第三者 AI モデル（Gemini）を使用します。クローゼット、アイデンティティ写真、OOTD 記録はデフォルトで非公開です。コンテンツは、フィードへの公開、ボードの投稿、アイテムの出品を選択した場合にのみ他者に表示されます。` },
    { h: 'アイデンティティ（顔・身体）写真', p: `試着のために追加した参照写真は、生成画像でご本人の姿を保持する目的にのみ使用されます。非公開で保存され、公開フィードに表示されることはなく、いかなるモデルの学習にも使用されません。設定からいつでも削除できます。` },
    { h: '保存と処理', p: `データは Google Firebase（認証、Firestore、Cloud Storage）に保存され、Google Cloud で処理されます。画像は暗号化された接続で配信されます。アカウントが存在する限りデータを保持します。` },
    { h: '分析', p: `当社は、アプリの利用状況（例：どの画面が表示されるか、機能のパフォーマンス）を把握し drape を改善するために Google Firebase Analytics を使用します。これはアプリが生成した識別子に紐づく利用・端末データであり、クローゼットやアイデンティティ写真は含みません。端末のプライバシー設定で制限できます。` },
    { h: '共有', p: `当社はユーザーの個人データを販売しません。公開したコンテンツ（公開コーデ、ボード、出品、コメント、ハンドルとプロフィール写真）は他のユーザーに表示されます。アプリの運営のためにのみ、インフラ提供者（Google Firebase / Google Cloud、Gemini API）とデータを共有します。` },
    { h: 'ユーザーの選択', p: `個々のアイテム、コーデ、ボード、アイデンティティ写真をいつでも編集・削除できます。アカウント全体を削除すると、コンテンツも削除されます。リマインド通知は設定でオフにでき、プッシュは端末の設定でもオフにできます。` },
    { h: '児童', p: `drape は 13 歳未満（または居住国で定められた最低年齢未満）の児童を対象としておらず、その情報を故意に収集することはありません。` },
    { h: '変更', p: `本ポリシーは変更される場合があり、重要な変更は新しい発効日で示されます。変更後も利用を続けた場合、改訂後のポリシーに同意したものとみなされます。` },
    { h: 'お問い合わせ', p: `プライバシーに関するお問い合わせ：${LEGAL_CONTACT}` },
  ],
};

export const TERMS = {
  en: [
    { p: `These Terms govern your use of drape. By using the app you agree to them.` },
    { h: 'The service', p: `drape lets you build a digital closet, generate AI virtual try-on images, plan and share outfits, and buy or sell items in a marketplace. We may add, change, or remove features over time.` },
    { h: 'Your account', p: `You are responsible for activity on your account and for the content you upload. Provide accurate information and keep your sign-in secure.` },
    { h: 'Your content', p: `You keep ownership of the photos and text you upload. By posting content publicly (feed, boards, marketplace), you grant other users the ability to view it within the app. You are responsible for having the right to upload what you post.` },
    { h: 'Acceptable use', p: `Do not upload content that is illegal, infringing, hateful, sexually explicit, or that depicts other people without their consent. Do not abuse the AI features, attempt to disrupt the service, or scrape data. We may remove content or suspend accounts that violate these rules.` },
    { h: 'AI-generated images', p: `Virtual try-on and analysis results are produced by third-party AI models and may be inaccurate or unrealistic. They are provided "as is" for personal styling use and should not be relied on as a true representation of any product or person.` },
    { h: 'Marketplace', p: `Listings, prices, and transactions are between buyers and sellers. drape is not a party to any sale and is not responsible for the condition, legality, or delivery of listed items. Sellers must have the right to sell what they list.` },
    { h: 'Credits and purchases', p: `Some features (such as generation credits) may require in-app purchases. Purchases are handled by the App Store or Google Play and are subject to their terms. Credits have no cash value and are non-refundable except where required by law.` },
    { h: 'Disclaimer & liability', p: `The service is provided "as is" without warranties. To the extent permitted by law, we are not liable for indirect or consequential damages arising from your use of the app.` },
    { h: 'Termination', p: `You may stop using drape and delete your account at any time. We may suspend or terminate access for violations of these Terms.` },
    { h: 'Changes', p: `We may update these Terms; material changes will be reflected by a new effective date. Continued use means you accept the updated Terms.` },
    { h: 'Contact', p: `Questions about these Terms: ${LEGAL_CONTACT}` },
  ],
  ko: [
    { p: `본 약관은 drape 이용에 적용됩니다. 앱을 사용함으로써 본 약관에 동의하는 것으로 간주됩니다.` },
    { h: '서비스 내용', p: `drape는 디지털 옷장 구성, AI 가상 피팅 이미지 생성, 코디 계획·공유, 마켓플레이스에서의 거래 기능을 제공합니다. 기능은 추가·변경·삭제될 수 있습니다.` },
    { h: '계정', p: `이용자는 본인 계정에서의 활동과 업로드한 콘텐츠에 대해 책임을 집니다. 정확한 정보를 제공하고 로그인 정보를 안전하게 관리하세요.` },
    { h: '이용자 콘텐츠', p: `업로드한 사진과 텍스트의 소유권은 이용자에게 있습니다. 콘텐츠를 공개(피드, 보드, 마켓)하면 다른 이용자가 앱 내에서 볼 수 있도록 허용하는 것입니다. 게시하는 콘텐츠를 업로드할 권리는 이용자에게 있어야 합니다.` },
    { h: '금지 행위', p: `불법·침해·혐오·성적으로 노골적인 콘텐츠, 또는 타인의 동의 없이 타인을 묘사하는 콘텐츠를 업로드하지 마세요. AI 기능을 악용하거나, 서비스를 방해하거나, 데이터를 무단 수집하지 마세요. 규정을 위반하는 콘텐츠는 삭제되거나 계정이 정지될 수 있습니다.` },
    { h: 'AI 생성 이미지', p: `가상 피팅 및 분석 결과는 제3자 AI 모델이 생성하며 부정확하거나 비현실적일 수 있습니다. 개인적 스타일링 용도로 "있는 그대로" 제공되며, 특정 제품이나 인물의 실제 모습으로 신뢰해서는 안 됩니다.` },
    { h: '마켓플레이스', p: `게시글, 가격, 거래는 구매자와 판매자 간의 일입니다. drape는 어떤 거래의 당사자가 아니며 등록 아이템의 상태·적법성·배송에 책임지지 않습니다. 판매자는 등록 아이템을 판매할 권리가 있어야 합니다.` },
    { h: '크레딧 및 결제', p: `일부 기능(예: 생성 크레딧)은 인앱 구매가 필요할 수 있습니다. 결제는 App Store 또는 Google Play를 통해 처리되며 해당 약관이 적용됩니다. 크레딧은 현금 가치가 없으며 법으로 요구되는 경우를 제외하고 환불되지 않습니다.` },
    { h: '면책 및 책임 제한', p: `서비스는 어떠한 보증 없이 "있는 그대로" 제공됩니다. 법이 허용하는 범위 내에서, 당사는 앱 사용으로 인한 간접적·결과적 손해에 책임지지 않습니다.` },
    { h: '해지', p: `이용자는 언제든 drape 사용을 중단하고 계정을 삭제할 수 있습니다. 당사는 본 약관 위반 시 접근을 정지·종료할 수 있습니다.` },
    { h: '변경', p: `본 약관은 변경될 수 있으며, 중요한 변경은 새로운 시행일로 표시됩니다. 변경 후 계속 사용하면 개정된 약관에 동의하는 것으로 간주됩니다.` },
    { h: '문의', p: `약관 관련 문의: ${LEGAL_CONTACT}` },
  ],
  ja: [
    { p: `本規約は drape の利用に適用されます。本アプリを利用することで、本規約に同意したものとみなされます。` },
    { h: 'サービス内容', p: `drape はデジタルクローゼットの構築、AI バーチャル試着画像の生成、コーデの計画・共有、マーケットプレイスでの売買を提供します。機能は追加・変更・削除される場合があります。` },
    { h: 'アカウント', p: `ユーザーはご自身のアカウントでの活動およびアップロードしたコンテンツについて責任を負います。正確な情報を提供し、サインイン情報を安全に管理してください。` },
    { h: 'ユーザーコンテンツ', p: `アップロードした写真とテキストの所有権はユーザーに帰属します。コンテンツを公開（フィード、ボード、マーケット）すると、他のユーザーがアプリ内で閲覧できるようになります。投稿するコンテンツをアップロードする権利はユーザーが有している必要があります。` },
    { h: '禁止事項', p: `違法・権利侵害・差別的・性的に露骨なコンテンツ、または本人の同意なく他者を描写するコンテンツをアップロードしないでください。AI 機能の悪用、サービスの妨害、データの無断収集を行わないでください。規約に違反するコンテンツは削除され、アカウントが停止される場合があります。` },
    { h: 'AI 生成画像', p: `バーチャル試着および分析結果は第三者の AI モデルによって生成され、不正確または非現実的な場合があります。個人的なスタイリング用途として「現状のまま」提供され、特定の製品や人物の実際の姿として信頼すべきではありません。` },
    { h: 'マーケットプレイス', p: `出品、価格、取引は購入者と販売者の間のものです。drape はいかなる取引の当事者でもなく、出品アイテムの状態・適法性・配送について責任を負いません。販売者は出品アイテムを販売する権利を有している必要があります。` },
    { h: 'クレジットと購入', p: `一部の機能（生成クレジットなど）はアプリ内購入が必要な場合があります。購入は App Store または Google Play を通じて処理され、それぞれの規約が適用されます。クレジットには現金価値がなく、法律で義務付けられる場合を除き返金されません。` },
    { h: '免責と責任の制限', p: `サービスはいかなる保証もなく「現状のまま」提供されます。法律が許す範囲において、当社はアプリの利用に起因する間接的・結果的損害について責任を負いません。` },
    { h: '解約', p: `ユーザーはいつでも drape の利用を停止し、アカウントを削除できます。当社は本規約違反の場合、アクセスを停止・終了することがあります。` },
    { h: '変更', p: `本規約は変更される場合があり、重要な変更は新しい発効日で示されます。変更後も利用を続けた場合、改訂後の規約に同意したものとみなされます。` },
    { h: 'お問い合わせ', p: `本規約に関するお問い合わせ：${LEGAL_CONTACT}` },
  ],
};
