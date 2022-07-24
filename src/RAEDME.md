전송
```js
var chatMessage = $('.emojionearea-editor').html();
$('.emojionearea-editor').html('');

if (!chatMessage || !chatMessage.replace(/ /g, '').length) return;

var checkmark_id = connection.userid + connection.token();

appendChatMessage(chatMessage, checkmark_id);

connection.send({
    chatMessage: chatMessage,
    checkmark_id: checkmark_id
});

connection.send({
    typing: false
});
```