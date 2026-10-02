const SPREADSHEET_ID = 'REDACTED';
// ===== 스프레드시트 캐싱 (같은 요청 내 재사용) =====
let _ssCache = null;
function _getSS() {
  if (!_ssCache) _ssCache = SpreadsheetApp.openById(SPREADSHEET_ID);
  return _ssCache;
}
function getSheet(name) {
  const ss = _getSS();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initSheetHeaders(sheet, name);
  }
  return sheet;
}
function initSheetHeaders(sheet, name) {
  const headers = {
    '학생계정':    ['이름','PIN','역할','반'],
    '일기기록':    ['ID','날짜','학생이름','기분이모지','기분라벨','기분색상','일기내용','비밀여부','공개여부','나만보기','저장시간','사진URLs'],
    '게시판':      ['ID','작성자','내용','기분','날짜표시','좋아요수','작성시간'],
    '게시판댓글':  ['ID','게시글ID','작성자','내용','작성시간','부모댓글ID'],
    '게시판좋아요':['게시글ID','학생이름'],
    '칭찬메시지':  ['ID','보낸사람','받는사람','메시지','작성시간','읽음여부','익명여부','숨김여부','승인상태'],
    '선생님댓글':  ['ID','일기ID','선생님이름','댓글내용','작성시간','역할','부모댓글ID'],
    '학생태그':    ['이름','상담필요','메모','설정자','설정시간'],
  };
  if (headers[name]) {
    const h = headers[name];
    sheet.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
  }
}
// ===== 아이콘 (data URI 내장: setupIcon 실행 없이 즉시 반영) =====
// OKGU_ICON_B64_START  (아이콘 교체 시 이 상수만 갈아주세요)
const ICON_DATA_URI = 'data:image/png;base64,' +
  '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';
// OKGU_ICON_B64_END

// ===== HTML 서빙 =====
function doGet(e) {
  if (e && e.parameter && e.parameter.fn) {
    return _handleJsonpRpc_(e);
  }

  // ICON_DATA_URI(코드 내 base64)를 항상 우선 사용 → 아이콘 교체 즉시 반영
  // (과거 ICON_URL이 있어도 무시하여 신규 아이콘이 확실히 적용되게 함)
  var iconUrl = ICON_DATA_URI;
  var iconVer = '20260418'; // 아이콘 캐시 버스팅용 버전 (갈아끼울 때 숫자 변경)

  // iOS 16.4+ PWA 매니페스트 엔드포인트
  if (e && e.parameter && e.parameter.manifest) {
    var manifest = {
      name: 'OKGU DIARY', short_name: '일기',
      start_url: ScriptApp.getService().getUrl(),
      display: 'standalone',
      background_color: '#F5F5F5', theme_color: '#111111',
      icons: [
        {src: iconUrl, sizes: '192x192', type: 'image/png'},
        {src: iconUrl, sizes: '512x512', type: 'image/png'}
      ]
    };
    return ContentService.createTextOutput(JSON.stringify(manifest))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var t = HtmlService.createTemplateFromFile('Index');
  t.iconUrl = iconUrl;
  t.iconVer = iconVer;
  return t.evaluate()
    .setTitle('OKGU DIARY')
    .addMetaTag('viewport','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

function _handleJsonpRpc_(e) {
  const callback = String((e.parameter && e.parameter.callback) || 'callback');
  const safeCallback = /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)
    ? callback
    : 'callback';
  const fnName = String((e.parameter && e.parameter.fn) || '');

  let args = [];
  try {
    args = JSON.parse((e.parameter && e.parameter.p) || '[]');
    if (!Array.isArray(args)) args = [];
  } catch(e2) {
    args = [];
  }

  let payload;
  try {
    const fn = globalThis[fnName];
    if (typeof fn !== 'function') throw new Error(fnName + ' is not defined');
    payload = { ok: true, result: fn.apply(null, args) };
  } catch(err) {
    payload = { ok: false, error: err && err.message ? err.message : String(err) };
  }

  return ContentService
    .createTextOutput(safeCallback + '(' + JSON.stringify(payload) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ===== 아이콘 드라이브 업로드 (최초 1회 실행) =====
function setupIcon() {
  var iconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAmA0lEQVR42u3dd5hV5Z3A8d/QhyoGy4iIgNIUV0SDLkZplsSuq7FFY0vEsKIIMsZExbhqdm1Zd7ETso8KuzaKiAKixgIqQcSGY4gCAoIKCkhnZv8wGhNRgXnPzL1zP5/n8Uli4L3nnnvuzPe09xRVVFRUBABQUGpZBQAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAABIBVAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAABAAFgFACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAsOXqFOKbfvLJJ6Nv375V+pq1a9eO4uLiKC4ujgYNGnz537fddtto2bJltGzZMnbeeedo2bJltGrVKvbYY48oLi72eWylG264IS655JK8Wg+XXHJJ3HTTTZm+xuTJk6NPnz6+r5XUsGHDaNy4cTRu3DiaNGny5X//4n/vtttu0blz5+jcuXO0a9cu6tSp3h+15513Xtx9993Jx33wwQfjhBNOyMnt5vzzz4877rgj6Zg77rhjvPfee1G/fn0BwObbuHFjrFy5MlauXLnZwdChQ4fYe++9Y++9946uXbtGjx49CiYKCtEjjzyS+Ws8/PDDeRcAuWjVqlWxatWqWLJkyXf+2bp160b79u2jc+fO0alTpzjwwAOjV69eVRoFl156aQwfPjzKy8uTjnv77bfnZACsWLEi7rvvvuTjDhw4sMb88o+IiIoCNHny5IqIyLt/GjRoUHHooYdW3HTTTRVvvvmmz+Nb/rnhhhvyah288sorVbINlZSUVJSXl/u+VvM/zZs3rzjjjDMqHnnkkYpVq1ZVyXo86aSTkr+PoqKiirKyspzbZoYNG5b8vW6zzTYVy5cvr1G/C10DkEfWrFkTEydOjIEDB0bnzp2jTZs2MXTo0Jg3b56VY+9/syxatCimTZtmhVezZcuWxf/8z//EcccdFy1atIgTTjghRo4cGevXr8/sNS+77LIsdiCTH2ZPdWQitf79+0eTJk1q1HYoAPLYe++9F1dddVW0adMmDj/88HjwwQcz/QFCtofma1pssHlWrVoVDz/8cJx66qnRrl27uPXWW2P16tXJX2fvvfeOww8/PPm4v//972PNmjU5sz6nTp0as2bNSjpmw4YNY8CAATVu2xMANUB5eXk88cQTceKJJ0b79u1jxIgRsXHjRismT7zzzjvx+uuv18jYYMvMnz8/Lrzwwmjbtm0m57CzOAqwdOnSeOCBB3JmHd52223Jxzz33HOjRYsWAoDcPypw1llnRefOnWPUqFHJL/oh//fI58yZk3wPibQ++OCDOP3006N3795RVlaWbNyDDjooevTokXx5szjknisxUrdu3Rg0aFCN3M4EQA1VVlYWp5xySuy///7xxhtvWCE5rDr2yJ0GyA9PPfVUdOvWLR588MGcPgrwwgsv5ERUZnE64vTTT49WrVoJAPLPyy+/HN26dYvrr7/eaYEctGDBgnjppZcKIjrYOitXrowTTzwxLr300iRH9I444ojYa6+9atxRgCwuSKxVq1ZceumlNXbbEgAFYO3atXHZZZfFAQccEO+8844VkkNGjx4dFRUVVf66s2bNijlz5vgA8sh//Md/xHnnnZdkeyktLU2+fPfee+9mz3OShSlTpiT/+XbcccdFx44dBQA142jA/vvvH88884yVkSOqc0/caYD8M3z48Pj5z39e6Qg46aSTol27dkmXLavJdzZXFhf/ZRFKAoBqs3Tp0jjkkENixIgRVkY1+/jjj6s1xpwGyE933XVXXHPNNZUao3bt2jF48OC8+CW8ORYtWhRjxoxJOuYhhxwS++67rwCgZlm/fn2cddZZccUVV1gZ1WjcuHHVel3GtGnTYuHChT6IPHTVVVfFU089VakxfvrTn0ZJSUnS5Xr11VfjxRdfrPL1cc8998SGDRuSjpnFxZICgJzxm9/8Jq699lorokD3wCsqKpLvNVE1ysvL49RTT40PP/xwq8eoX79+DBw4MO+PAmzcuDHuvPPOpGN27949evXqJQCo2S6//PLkXx6+28qVK2PSpEkFHyFsvQ8++CCuvPLKSo3x85//PJo3b550uf73f/83li1bVmXr4bHHHov58+cnHfOXv/xlQWxDAoDo169fPPTQQ1ZEFZowYUKl71feaaedKr0cTz/9dCxdutQHkqfuvPPOSs3z0aRJk+jfv3/SZVqzZk2VXmOU+ojDHnvsEUcddVRBbD8eB5xIly5dokOHDl/79xUVFbFixYpYtmzZl/988sknOXVPfnl5eZx++unRvn376NKliw8zD/a8W7RoEU888USlP68NGzbEuHHj4swzzyyo9d+rV6/o3r37Fv2dioqKWLdu3ZePAl61alWsXLky5s6dG3/5y19i3bp1Vf4+Nm7cGKWlpTFu3LitHuPCCy+MG2+8MVatWpVsuW6//fa4+OKLM3//7733XjzxxBNJxywtLY2ioiIBwOY788wz45JLLtnsP798+fJYunRpzJ49O2bOnBmvvvpq/PGPf6y2i7LWrFkTp5xySkyfPj0aNGjgA83QunXrYvz48ZUao2fPnrHnnntGSUlJLFq0qFJjPfLIIwUXAEccccQWfV83J6Lnz58fZWVl8fTTT8eECRNi5syZVTLHw/jx4+Mvf/lLtG3bdqtj8rzzzovf/e53yZaprKwsnnrqqczPo995551Jpzvfdddd4+STTy6Y74FTANWkadOmseuuu8bhhx8epaWlMXLkyFiwYEHMmjUr/v3f/z26du1a5cv0xhtvJP2hyKZNnjw5VqxYUekAiIjo06dPpZfniSeeiM8++8wHU5kfpLVqRevWreOQQw6Jf/u3f4sZM2bEggUL4sYbb4ztt98+09euqKiIu+66q1JjXHLJJVG3bt2ky5X1xYDr1q2Le+65J+mYgwcPjjp1Cme/WADkmC5dusTgwYNjxowZMX369PjZz34W9erVq7LXHzZsWIwdO9YHkaEUF959sWeVIgDWrFkTEyZM8MEkVlJSEgMHDox33303fvvb30azZs0ye63hw4dX6ja4Vq1axemnn550mUaPHh0ffPBBZu/5kUceiSVLliQbb4cddoizzz67sMLV1zR3devWLe64444oKyuLM888M2rVqpqPq3///jn1fO+aZOPGjZW+9W677baLTp06JQuAL36Yko2GDRvGpZdeGi+88EK0bt06k9dYsmRJpe+/HzJkSNKfMevXr0++h57lEYaLL7644E5/CoA80Lp16xgxYkRMmzZtkxcapjZ//vy45ZZbrPgMPPfcc/HRRx9VaoyePXt+eZFSq1aton379pVerkcffbRaLmIrJJ07d46pU6fGP/3TP2UyfmVvK+3QoUMcf/zxSZcp9Tn6L7z11ltJZ9Fs1qxZ9OvXr+C2SQGQR/bbb7+YMWNGnH/++Zm/1nXXXVepSUbYtBSH/784//+Fvn37VnrM5cuXx5NPPukDylhJSUk89NBDUVxcnHMBEJF+9rt58+Zlcnop9VP/fvGLX0TTpk0FALmtYcOGcdttt8WNN96Y6a0qy5cvj6uuusoKTyzFofZ/vLLaaYD80q5duxg6dGjycV966aVKH8XZZ5994tBDD026XKkP1a9evTr+8Ic/JBuvuLg4BgwYUJDbogDIUwMHDox777030+sC7rrrrkrfYsbfTJ8+vdIzlm2//fZfnv//ahCk2A5Gjx6dyeFaNv39Tf00vg0bNiR5xHPqowATJkyIuXPnJhtv1KhR8cknnyQb75xzzsn8Tg0BQHKnnnpq3HzzzZmNv379etMEJ5TF4f+IiObNm8c+++xT6bE//PDDeO6553xQVaB27drxL//yL8nHLSsrS7KN7b///smWqby8vNK3KX7V7bffnmysOnXqxKBBgwp2OxQAee7CCy9MPpXnV91xxx2xfv16KzpHAuCbJlZJcR1AhNMAVenYY49NPubbb7+dZJzUc+GPGDEi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ZcuWxVFHHRXLli3L7DX69etnRWew93/00UdHy5Ytq/19/ehHP0oaAG+99VbMnj07OnbsWHDbSKtWraJ///5xww03JB974MCB8corr5iKm6RsTXlqyZIl0bt373j77bcze41u3brFQQcdZGUnDoCioqKc2Zs75JBDcj6W8slll10WzZo1Sz7urFmzYvjw4b6ICIBCN2/evPjBD34QM2fOzPR1Uj/yNF999NFH8eyzzyYbb5999smZSZW6dOkSO+ywQ9IxC/liyW233TazR9X+6le/ihUrVvhCIgAK1ZgxY2KfffbJ/Mrgww47LPr27WuFR8TYsWNj48aNycbLpSmVi4qKkh8FmD59esybN69gt5cBAwbETjvtlHzcxYsXx3XXXecLiQAoNJ9++mlccMEFceyxx8bHH3+c+S8Fe//Z7dFmcdg915Zn9OjRBbu9FBcXx1VXXZXJ2DfffLOpqBEAhWL9+vVx6623Rrt27eK2226rktf8yU9+EnvvvbeVH58/o33y5MnJxmvYsGH88z//c40PgEKfM+Hss8+ODh06JB93zZo1mZ1iQACQIxYvXhzXXntttGvXLi688MLM9/q/0LJly7jlllt8AH/12GOPxdq1a5ONd9BBB0X9+vVz6j2WlJQkf6rds88+Gx9++GHBbjdZPiho1KhRMXXqVF9OBEBNsnDhwrjrrrvi6KOPjlatWsXll18e8+fPr7LXLyoqihEjRkTz5s19GBntyebqI5VTL1d5eXmMHTu2oLed448/Prp3757J2BdffHFmc38gAMjQypUr4+23345JkybFTTfdFKeffnp06tQpdt555/jZz34W48aNq5ZHgQ4YMMCFf1+xdu3aeOyxx5KOmWvn/7NcLlMnZ/egoBdffDFGjhzpS0qlmAgokVtuuSVGjRr1tX9fUVER69evj9WrV8fq1atj+fLlsXz58pxb/q5du7rC+B9MmjQpVq5cmWy8kpKSnH2o0sEHHxz16tWLdevWJRtz8uTJsXz58mjatGnBbkMHH3xw/OhHP0oekhERpaWlcdxxx0VxcbEvKwKgOr3//vvx/vvv5+Wyt27dOsaPHx8NGjTwQWa4B5ure/8Rn1+c2KNHj3jqqaeSjblu3bp47LHH4uSTTy7o7ei6666Lxx9/PMrLy5OOO3/+/LjpppsyewooNZ9TAAWuefPmMWHChCgpKbEyvmLjxo3Jz2HncgBktXxOA0Tstddecdppp2Uy9vXXXx8ffPCBLywCgC3ToEGDGDNmTHTq1MnK+Ad//OMfk995kevXV2QRAI899ljyh+Pko6uvvjrq1auXfNyVK1c6AoAAYMs0a9YsJkyYED/4wQ+sjCrYc91rr71ixx13zOn3nMUUxZ999llMmjSp4LenXXfdNS644IJMxh4xYkTm04IjAKghWrZsGc8991z07NnTytiEioqK5A+0yfXD/xERtWrVyuQhRU4DfO7yyy/P5ILI8vLyGDhwoBWMAODbde7cOaZOnZqzV6PngpdffjkWLFhQcAGQ1XKOHTs2NmzYUPDbVYsWLWLw4MGZjP3UU0/FmDFjfHkRAGzaT3/605g2bVq0atXKyqjCPdb69evnzWOVswiApUuXxjPPPGPDis8n8MnqVNDgwYOrZf4QBAA57Hvf+148+OCD8fvf/z6aNGlihVRxABx44IF5c69269ato3379snHTX1KJV81atQorrjiikzGfuedd+K///u/rWQEAJ878sgj47XXXosTTjjBytgMb7zxRrzzzjs5v1edb0cBHnnkEVPX/tV5550Xu+++eyZjX3311VX23BAEADmqW7duMWXKlBg3bpx7/Ktx7z8id+f/r8rlXbhwYbz44os2sIioU6dOXHPNNZmMvWzZshg6dKiVjAAoRG3bto37778/Xn755ejVq5cVUs0B0KJFi7x7tHLPnj2jTp30k4Q6DfA3J554Yuy7776ZjH3bbbfF7NmzrWQEQCEoKiqKQw89NEaPHh1lZWVxyimnRFFRkRWzhd59993k91P37ds37z6Lpk2bZvIUO7cD/v139vrrr89k7A0bNmR2twECgBxRUlISl1xySZSVlcUTTzwRxxxzTNSuXduKyaE91Hw7/J/lcv/5z3+O1157zYb2V3369Mls+3j00Udj8uTJVjICoCbp2rVrXHHFFV/eq37DDTfEbrvtZsXk6B5qvj5eOasLF50G+HvXX399ZkeIBg4cGBs3brSSEQD5aNttt42+fftGaWlpPPDAA7FgwYKYMWNGDB06NPbdd1+H+RNavHhxTJ06NemYHTt2zNs5F77//e9Hs2bN8iKy8j3os3pa4muvvRb33HOPlcw38jjgqqytWrWiQYMGUVxcHMXFxdGwYcMoLi6O7bbbLnbZZZdo1arVl/+52267RZs2bay0KjJ69Ojkj2vNt9v/vqp27drRu3fv5Hvsr776asyZMyfatWtno/ura665Jh588MFMJvH59a9/HSeffHImUxCT/4oq3JwLAIW3U2oVAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAAAQAFYBAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAAEAAAgAAAAAQAACAAAQAAAAAIAABAAAIAAAAABYBUAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAQAACAAAAABAAAIAABAAAAAAgAAEAAAgAAAAAEAAAgAAEAAAAACAAAQAACAAAAABAAAIAAAAAEAAAgAAEAAAAACAAAQAADAlvt/WU29uBYromEAAAAASUVORK5CYII=';
  var blob = Utilities.newBlob(Utilities.base64Decode(iconBase64), 'image/png', 'okgu_icon.png');
  var folder = DriveApp.getRootFolder();
  var files = folder.getFilesByName('okgu_icon.png');
  while (files.hasNext()) { files.next().setTrashed(true); }
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w512';
  PropertiesService.getScriptProperties().setProperty('ICON_URL', url);
  Logger.log('Icon URL saved: ' + url);
  return url;
}
// =============================================
// ===== 날짜 유틸 =====
// =============================================
function _rowDate(val) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) return _dateKey(val);
  const s = String(val).trim();
  if (!s) return '';
  if (s.includes('T')) return s.split('T')[0];
  if (s.includes('/')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return _dateKey(d);
  }
  return s;
}
function _dateKey(dt) {
  return dt.getFullYear() + '-' +
    String(dt.getMonth() + 1).padStart(2, '0') + '-' +
    String(dt.getDate()).padStart(2, '0');
}
function getTodayKey() { return _dateKey(new Date()); }
function _fmtDisp(dateKey) {
  if (!dateKey) return '';
  const parts = String(dateKey).split('-').map(Number);
  if (parts.length < 3) return dateKey;
  const [y, m, d] = parts;
  const days = ['일','월','화','수','목','금','토'];
  const dt = new Date(y, m - 1, d);
  return m + '월 ' + d + '일 (' + days[dt.getDay()] + ')';
}
function _fmtTime(isoStr) {
  if (!isoStr) return '';
  try {
    const dt   = new Date(isoStr instanceof Date ? isoStr.toISOString() : isoStr);
    const now  = new Date();
    const diff = Math.floor((now - dt) / 1000);
    if (diff < 60)     return '방금';
    if (diff < 3600)   return Math.floor(diff / 60) + '분 전';
    if (diff < 86400)  return Math.floor(diff / 3600) + '시간 전';
    if (diff < 172800) return '어제';
    return (dt.getMonth() + 1) + '월 ' + dt.getDate() + '일';
  } catch(e) { return ''; }
}
function _fmtDatetimeKr(isoStr) {
  if (!isoStr) return '';
  try {
    const dt   = new Date(isoStr instanceof Date ? isoStr.toISOString() : isoStr);
    const m    = dt.getMonth() + 1;
    const d    = dt.getDate();
    const h    = dt.getHours();
    const min  = String(dt.getMinutes()).padStart(2, '0');
    const ampm = h < 12 ? '오전' : '오후';
    const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m + '월 ' + d + '일 ' + ampm + ' ' + h12 + ':' + min;
  } catch(e) { return ''; }
}
function _fmtHM(isoStr) {
  if (!isoStr) return '';
  try {
    const dt = new Date(isoStr instanceof Date ? isoStr.toISOString() : isoStr);
    if (isNaN(dt.getTime())) return '';
    return String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
  } catch(e) { return ''; }
}
function _isoStr(val) {
  if (!val) return '';
  return val instanceof Date ? val.toISOString() : String(val);
}
// =============================================
// ===== 공통 응답/검증/캐시/토큰 헬퍼 (Phase1) =====
// =============================================
// 11. 응답 일관성
function _ok(data)        { return Object.assign({ success: true }, data || {}); }
function _err(msg, code)  { return { success: false, msg: msg || '오류가 발생했어요', code: code || 'E_UNKNOWN' }; }
// 2. 서버측 XSS/길이 검증
function _sanitize(text) {
  if (text == null) return '';
  return String(text).replace(/<script[\s\S]*?<\/script>/gi, '')
                     .replace(/<[^>]*>/g, '')
                     .trim();
}
function _validateText(text, field, maxLen) {
  const s = text == null ? '' : String(text);
  if (!s.trim()) return { error: _err((field||'내용') + '을(를) 입력해주세요', 'E_EMPTY') };
  const limit = maxLen || 5000;
  if (s.length > limit) return { error: _err((field||'내용') + '이(가) 너무 길어요 (최대 ' + limit + '자)', 'E_TOO_LONG') };
  return { value: _sanitize(s) };
}
// 9. CacheService 래퍼 (비용큰 시트 읽기 캐싱)
function _cacheGet(key, fn, ttlSec) {
  try {
    const cache = CacheService.getScriptCache();
    const hit = cache.get(key);
    if (hit) { try { return JSON.parse(hit); } catch(e) {} }
    const fresh = fn();
    try { cache.put(key, JSON.stringify(fresh), ttlSec || 300); } catch(e) {}
    return fresh;
  } catch(e) { return fn(); }
}
function _cacheBust(keys) {
  try {
    const cache = CacheService.getScriptCache();
    if (Array.isArray(keys)) cache.removeAll(keys);
    else if (keys) cache.remove(keys);
  } catch(e) {}
}
// 4. 세션 토큰 (교사 권한 검증용 — PropertiesService 기반, 30일 TTL)
// CacheService는 최대 6시간 제한이 있어 장기 세션용으로 PropertiesService 사용
const _TOKEN_TTL_SEC_DEFAULT = 7 * 24 * 3600;
const _TOKEN_TTL_SEC_REMEMBER = 30 * 24 * 3600;
function _makeToken(name, role, cls, remember) {
  const token = 'tok_' + Utilities.getUuid();
  const ttl = remember ? _TOKEN_TTL_SEC_REMEMBER : _TOKEN_TTL_SEC_DEFAULT;
  const payload = { name: name, role: role, cls: cls, exp: Date.now() + ttl * 1000 };
  try {
    PropertiesService.getScriptProperties().setProperty(token, JSON.stringify(payload));
  } catch(e) {}
  return token;
}
function _verifyToken(token) {
  if (!token || typeof token !== 'string' || token.indexOf('tok_') !== 0) return null;
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(token);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p.exp && p.exp < Date.now()) {
      try { PropertiesService.getScriptProperties().deleteProperty(token); } catch(e) {}
      return null;
    }
    return p;
  } catch(e) { return null; }
}
function _requireTeacher(token) {
  const p = _verifyToken(token);
  if (!p) return null;
  if (p.role !== '선생님') return null;
  return p;
}
function logout(token) {
  try { if (token) PropertiesService.getScriptProperties().deleteProperty(token); } catch(e) {}
  return _ok();
}
// 클라이언트 자동 로그인용 토큰 검증 API
function verifyToken(token) {
  const p = _verifyToken(token);
  if (!p) return _err('세션이 만료되었어요', 'E_AUTH');
  return _ok({ name: p.name, role: p.role, cls: p.cls });
}
// 만료 토큰 일괄 정리 (선택적 수동 실행용)
function cleanupExpiredTokens() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  let removed = 0;
  const now = Date.now();
  Object.keys(all).forEach(function(k){
    if (k.indexOf('tok_') !== 0) return;
    try {
      const p = JSON.parse(all[k]);
      if (p.exp && p.exp < now) { props.deleteProperty(k); removed++; }
    } catch(e) { props.deleteProperty(k); removed++; }
  });
  return '만료 토큰 정리: ' + removed + '개';
}
// =============================================
// ===== 인증 =====
// =============================================
// ── PIN 해시화 (SHA-256 + per-user salt) ──
// 저장 포맷: "sha256$<salt>$<base64hash>" — 이 포맷이 아니면 평문 PIN으로 간주(legacy)
function _genSalt() {
  // 짧은 10자 salt (UUID 일부). 학교용 환경에서는 충분.
  return Utilities.getUuid().replace(/-/g, '').substring(0, 10);
}
function _sha256b64(str) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(str),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(bytes);
}
function _hashPin(pin, salt) {
  return 'sha256$' + salt + '$' + _sha256b64(salt + '|' + String(pin));
}
function _makePinHash(pin) {
  const salt = _genSalt();
  return _hashPin(pin, salt);
}
function _isHashedPin(stored) {
  return typeof stored === 'string' && stored.indexOf('sha256$') === 0;
}
function _verifyPin(inputPin, stored) {
  const p = String(inputPin || '').trim();
  const s = String(stored || '').trim();
  if (_isHashedPin(s)) {
    const parts = s.split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    return _hashPin(p, salt) === s;
  }
  // legacy 평문
  return p === s;
}

function login(name, pin, remember) {
  const sheet = getSheet('학생계정');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowName = String(data[i][0]).trim();
    const rowPin  = String(data[i][1]).trim();
    if (rowName === String(name).trim() && _verifyPin(pin, rowPin)) {
      const role = String(data[i][2]).trim();
      const cls  = String(data[i][3]).trim();
      // lazy 마이그레이션: 평문이었다면 해시로 업그레이드
      if (!_isHashedPin(rowPin)) {
        try {
          sheet.getRange(i + 1, 2).setValue(_makePinHash(pin));
          _cacheBust('students_v1');
          _cacheBust('students_with_teachers_v2');
        } catch(e) { /* 쓰기 실패해도 로그인은 통과 */ }
      }
      const token = _makeToken(rowName, role, cls, !!remember);   // 4. 세션 토큰 발급
      return _ok({ name: rowName, role: role, cls: cls, token: token });
    }
  }
  return _err('이름 또는 PIN이 맞지 않아요 🥲', 'E_AUTH');
}
function changePin(name, currentPin, newPin) {
  const v = _validateText(newPin, '새 PIN', 20);
  if (v.error) return v.error;
  const sheet = getSheet('학생계정');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(name).trim()) {
      const stored = String(data[i][1]).trim();
      if (!_verifyPin(currentPin, stored))
        return _err('현재 PIN이 맞지 않아요', 'E_PIN');
      sheet.getRange(i + 1, 2).setValue(_makePinHash(v.value));
      _cacheBust('students_v1');
      _cacheBust('students_with_teachers_v2');
      return _ok();
    }
  }
  return _err('계정을 찾을 수 없어요', 'E_NOT_FOUND');
}
// 일괄 수동 마이그레이션 (선택): Apps Script 편집기에서 1회 실행 가능
function migrateAllPinsToHash() {
  const sheet = getSheet('학생계정');
  const data  = sheet.getDataRange().getValues();
  let n = 0;
  for (let i = 1; i < data.length; i++) {
    const stored = String(data[i][1] || '').trim();
    if (stored && !_isHashedPin(stored)) {
      sheet.getRange(i + 1, 2).setValue(_makePinHash(stored));
      n++;
    }
  }
  _cacheBust('students_v1');
  _cacheBust('students_with_teachers_v2');
  return '변환 완료: ' + n + '명';
}
function getStudents() {
  // 9. 10분 캐시 (학생/담임 명단은 자주 바뀌지 않음)
  return _cacheGet('students_with_teachers_v2', function() {
    const data = getSheet('학생계정').getDataRange().getValues();
    const teachers = [];
    const students = [];
    data.slice(1).forEach(r => {
      const name = String(r[0] || '').trim();
      if (!name) return;
      const role = String(r[2] || '').trim();
      if (role === '선생님') teachers.push(name);
      else students.push(name);
    });
    return teachers.concat(students);
  }, 600);
}
// =============================================
// ===== 사진 업로드 =====
// =============================================
function uploadPhoto(base64Data, fileName, studentName) {
  try {
    const base64   = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const mimeType = base64Data.includes('data:') ? base64Data.split(';')[0].split(':')[1] : 'image/jpeg';
    const blob     = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
    const folder   = _getDiaryPhotoFolder(studentName);
    const file     = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w600' };
  } catch(e) {
    return { success: false, msg: e.message };
  }
}
function uploadPhotoChunk(uploadId, chunkIndex, totalChunks, chunk, fileName, studentName) {
  try {
    const safeUploadId = String(uploadId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
    const idx = Number(chunkIndex);
    const total = Number(totalChunks);
    if (!safeUploadId || !Number.isFinite(idx) || !Number.isFinite(total) ||
        idx < 0 || idx >= total || total < 1 || total > 250) {
      return { success: false, msg: '사진 업로드 정보가 올바르지 않아요.' };
    }

    const cache = CacheService.getScriptCache();
    const prefix = 'photo_' + safeUploadId + '_';
    const doneKey = prefix + 'done';
    cache.put(prefix + idx, String(chunk || ''), 21600);

    const doneUrl = cache.get(doneKey);
    if (doneUrl) return { success: true, done: true, url: doneUrl };

    const pieces = [];
    let ready = true;
    for (let i = 0; i < total; i++) {
      const part = cache.get(prefix + i);
      if (part == null) {
        ready = false;
        break;
      }
      pieces.push(part);
    }
    if (!ready) return { success: true, done: false, received: idx + 1, totalChunks: total };

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return { success: false, msg: '사진 업로드가 몰렸어요. 다시 시도해주세요.' };
    try {
      const lockedDoneUrl = cache.get(doneKey);
      if (lockedDoneUrl) return { success: true, done: true, url: lockedDoneUrl };

      const lockedPieces = [];
      for (let i = 0; i < total; i++) {
        const part = cache.get(prefix + i);
        if (part == null) return { success: true, done: false, received: idx + 1, totalChunks: total };
        lockedPieces.push(part);
      }

      const result = uploadPhoto(lockedPieces.join(''), fileName, studentName);
      if (result && result.success && result.url) cache.put(doneKey, result.url, 600);
      for (let i = 0; i < total; i++) cache.remove(prefix + i);
      return Object.assign({}, result, { done: true });
    } finally {
      lock.releaseLock();
    }
  } catch(e) {
    return { success: false, msg: e.message };
  }
}
function _getDiaryPhotoFolder(studentName) {
  const rootName = 'OKGU_DIARY_사진';
  const roots = DriveApp.getFoldersByName(rootName);
  const root  = roots.hasNext() ? roots.next() : DriveApp.createFolder(rootName);
  const subs  = root.getFoldersByName(studentName);
  return subs.hasNext() ? subs.next() : root.createFolder(studentName);
}
// =============================================
// ===== 일기 저장 (수정 포함) =====
// =============================================
function saveEntry(studentName, date, moodEmoji, moodLabel, moodColor, text, isSecret, isPublic, isMeOnly, photoUrlsJson, entryId) {
  // 2. 길이 검증 + 입력 정화
  const v = _validateText(text, '일기 내용', 2000);
  if (v.error) return v.error;
  const safeText = v.value;
  const sheet     = getSheet('일기기록');
  const dateKey   = _rowDate(date) || date;
  const id        = entryId ? String(entryId) : (studentName + '_' + dateKey + '_' + Date.now());
  const savedTime = new Date().toISOString();
  // 5. 게시판 동기화 조건: 공개이면서 비밀/나만보기가 아닐 때만
  const shouldShow = !!isPublic && !isSecret && !isMeOnly;
  const row = [id, dateKey, studentName, moodEmoji, moodLabel, moodColor, safeText,
               isSecret, isPublic, isMeOnly, savedTime, photoUrlsJson || '[]'];
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      if (shouldShow) _syncBoardFromEntry(id, studentName, safeText, moodEmoji, dateKey);
      else            _removeFromBoard(id);
      _notifyTeachersOfChange_(studentName + '님이 일기를 수정했어요.', 'diary-update-' + id, _okguDeepLink('diary', id));
      return _ok({ id: id });
    }
  }
  sheet.appendRow(row);
  if (shouldShow) _syncBoardFromEntry(id, studentName, safeText, moodEmoji, dateKey);
  _notifyTeachersOfChange_(studentName + '님이 새 일기를 올렸어요.', 'diary-new-' + id, _okguDeepLink('diary', id));
  return _ok({ id: id });
}
function deleteEntry(studentName, entryId) {
  const sheet = getSheet('일기기록');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === entryId && String(data[i][2]).trim() === studentName) {
      sheet.deleteRow(i + 1);
      _removeFromBoard(entryId);
      _notifyTeachersOfChange_(studentName + '님이 일기를 삭제했어요.', 'diary-delete-' + entryId, _okguDeepLink('dash', entryId));
      return _ok();
    }
  }
  return _err('일기를 찾을 수 없어요', 'E_NOT_FOUND');
}
// =============================================
// ===== 게시판 헬퍼 =====
// =============================================
function _syncBoardFromEntry(entryId, author, text, mood, dateKey) {
  const sheet = getSheet('게시판');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === entryId) {
      sheet.getRange(i + 1, 3, 1, 2).setValues([[text, mood]]);
      return;
    }
  }
  sheet.appendRow([entryId, author, text, mood, _fmtDisp(dateKey), 0, new Date().toISOString()]);
}
function _removeFromBoard(entryId) {
  const sheet = getSheet('게시판');
  const data  = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === entryId) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}
function _ensureBoardCommentParentColumn_() {
  const sheet = getSheet('게시판댓글');
  const lastCol = Math.max(sheet.getLastColumn(), 6);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers[5] !== '부모댓글ID') {
    sheet.getRange(1, 6).setValue('부모댓글ID').setFontWeight('bold');
  }
  return sheet;
}
function _ensureTeacherCommentParentColumn_() {
  const sheet = getSheet('선생님댓글');
  const lastCol = Math.max(sheet.getLastColumn(), 7);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers[6] !== '부모댓글ID') {
    sheet.getRange(1, 7).setValue('부모댓글ID').setFontWeight('bold');
  }
  return sheet;
}
function _findRecentDuplicateRow_(sheet, matcher, timeColIndex, windowMs) {
  const data = sheet.getDataRange().getValues();
  const now = Date.now();
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    if (!row[0]) continue;
    const t = new Date(row[timeColIndex]).getTime();
    if (!Number.isFinite(t)) continue;
    const age = now - t;
    if (age > windowMs) break;
    if (age >= 0 && matcher(row)) return { id: String(row[0]), row: row };
  }
  return null;
}
function _attachFallbackTeacherReplyParents_(comments) {
  let lastTeacherCommentId = '';
  (comments || []).forEach(function(c) {
    const role = String(c.role || '선생님').trim();
    if (role !== '학생') {
      lastTeacherCommentId = String(c.id || '');
    } else if (!c.parentId && lastTeacherCommentId) {
      c.parentId = lastTeacherCommentId;
    }
  });
  return comments || [];
}
function _attachFallbackBoardReplyParents_(comments, postAuthor) {
  let lastOtherCommentId = '';
  const owner = String(postAuthor || '').trim();
  (comments || []).forEach(function(c) {
    const author = String(c.author || '').trim();
    if (c.parentId) return;
    if (owner && author === owner && lastOtherCommentId) {
      c.parentId = lastOtherCommentId;
    } else {
      lastOtherCommentId = String(c.id || '');
    }
  });
  return comments || [];
}

// =============================================
// ===== 게시판 CRUD =====
// =============================================
function getBoard(filter, studentName, limit, offset) {
  const boardSheet   = getSheet('게시판');
  const commentSheet = _ensureBoardCommentParentColumn_();
  const likeSheet    = getSheet('게시판좋아요');
  const entrySheet   = getSheet('일기기록');
  const boardData   = boardSheet.getDataRange().getValues();
  const commentData = commentSheet.getDataRange().getValues().slice(1).filter(r => r[0]);
  const likeData    = likeSheet.getDataRange().getValues();
  const start = Math.max(0, Number(offset) || 0);
  const size  = Math.max(1, Math.min(Number(limit) || 12, 50));

  const pageRows = [];
  for (let i = boardData.length - 1; i >= 1; i--) {
    const r = boardData[i];
    if (!r[0]) continue;
    if (filter === 'mine' && r[1] !== studentName) continue;
    pageRows.push(r);
  }
  const page = pageRows.slice(start, start + size);
  const pageIds = {};
  page.forEach(r => { pageIds[String(r[0])] = true; });

  const entryPhotos = {};
  entrySheet.getDataRange().getValues().slice(1).forEach(r => {
    const id = String(r[0] || '');
    if (!id || !pageIds[id]) return;
    try { entryPhotos[id] = JSON.parse(r[11] || '[]'); } catch(e) { entryPhotos[id] = []; }
  });

  const commentMap = {};
  commentData.forEach(c => {
    const postId = String(c[1]);
    if (!pageIds[postId]) return;
    if (!commentMap[postId]) commentMap[postId] = [];
    commentMap[postId].push({
      id: String(c[0]),
      author: c[2],
      text: c[3],
      time: _fmtTime(_isoStr(c[4])),
      timeHM: _fmtHM(_isoStr(c[4])),
      parentId: String(c[5] || '')
    });
  });

  const posts = page.map(r => {
    const postId = String(r[0]);
    const likes = likeData.filter(l => String(l[0]) === postId && l[1]).length;
    const liked = likeData.some(l => String(l[0]) === postId && l[1] === studentName);
    const postTimeHM = _fmtHM(_isoStr(r[6]));
    return {
      id: postId,
      author: r[1],
      text: r[2],
      mood: r[3],
      date: r[4],
      likes,
      liked,
      comments: _attachFallbackBoardReplyParents_(commentMap[postId] || [], r[1]),
      timeHM: postTimeHM,
      photos: entryPhotos[postId] || []
    };
  });
  return { posts, hasMore: pageRows.length > start + size };
}
// 교사가 학생 일기 삭제 (비밀일기 등)  — 4. 토큰 인증 필수
function deleteEntryAsTeacher(token, entryId) {
  const teacher = _requireTeacher(token);
  if (!teacher) return _err('선생님 권한이 필요해요 (다시 로그인해주세요)', 'E_AUTH');
  const sheet = getSheet('일기기록');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === entryId) {
      sheet.deleteRow(i + 1);
      _removeFromBoard(entryId);
      return _ok();
    }
  }
  return _err('일기를 찾을 수 없어요', 'E_NOT_FOUND');
}
function deleteBoard(studentName, postId) {
  const sheet = getSheet('게시판');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === postId) {
      if (String(data[i][1]) !== studentName) return { success: false, msg: '본인 글만 삭제할 수 있어요' };
      sheet.deleteRow(i + 1);
      _cleanBoardComments(postId);
      _cleanBoardLikes(postId);
      _notifyTeachersOfChange_(studentName + '님이 게시판 글을 삭제했어요.', 'board-delete-' + postId, _okguDeepLink('board', postId));
      return { success: true };
    }
  }
  return { success: false, msg: '글을 찾을 수 없어요' };
}
function _cleanBoardComments(postId) {
  const sheet = _ensureBoardCommentParentColumn_();
  const data  = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === postId) sheet.deleteRow(i + 1);
  }
}
function _cleanBoardLikes(postId) {
  const sheet = getSheet('게시판좋아요');
  const data  = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === postId) sheet.deleteRow(i + 1);
  }
}
function toggleLike(postId, studentName) {
  const sheet = getSheet('게시판좋아요');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === postId && data[i][1] === studentName) {
      sheet.deleteRow(i + 1);
      _notifyTeachersOfChange_(studentName + '님이 게시글 좋아요를 취소했어요.', 'board-unlike-' + postId + '-' + studentName, _okguDeepLink('board', postId));
      return { liked: false };
    }
  }
  sheet.appendRow([postId, studentName]);
  _notifyTeachersOfChange_(studentName + '님이 게시글에 좋아요를 눌렀어요.', 'board-like-' + postId + '-' + studentName, _okguDeepLink('board', postId));
  return { liked: true };
}
function addComment(postId, author, text, parentId) {
  const v = _validateText(text, '댓글', 500);
  if (v.error) return v.error;
  const sheet = _ensureBoardCommentParentColumn_();
  const parent = parentId ? String(parentId) : '';
  const dup = _findRecentDuplicateRow_(sheet, function(r) {
    return String(r[1]) === String(postId) &&
      String(r[2]) === String(author) &&
      String(r[3]) === String(v.value) &&
      String(r[5] || '') === parent;
  }, 4, 8000);
  if (dup) return { success: true, id: dup.id, parentId: parent, duplicate: true };

  const id    = 'c_' + Date.now();
  sheet.appendRow([id, postId, author, v.value, new Date().toISOString(), parent]);
  try {
    const targets = [];
    const postAuthor = _getBoardAuthor(postId);
    if (postAuthor && postAuthor !== author) targets.push(postAuthor);
    if (parent) {
      const parentAuthor = _getBoardCommentAuthor_(parent);
      if (parentAuthor && parentAuthor !== author && targets.indexOf(parentAuthor) < 0) targets.push(parentAuthor);
    }
    if (targets.length) {
      _sendPushToNames(
        targets,
        'OKGU DIARY',
        author + '님이 게시글에 댓글을 남겼어요.',
        'board-comment-' + id,
        _okguDeepLink('board', postId, id)
      );
    }
    _notifyTeachersOfChange_(
      author + '님이 게시판에 ' + (parent ? '답글' : '댓글') + '을 남겼어요.',
      'teacher-board-comment-' + id,
      _okguDeepLink('board', postId, id)
    );
  } catch(e) {}
  return { success: true, id, parentId: parent };
}
function editComment(author, commentId, newText) {
  const v = _validateText(newText, '댓글', 500);
  if (v.error) return v.error;
  const sheet = getSheet('게시판댓글');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === commentId) {
      if (String(data[i][2]) !== author) return _err('본인 댓글만 수정할 수 있어요', 'E_FORBIDDEN');
      sheet.getRange(i + 1, 4).setValue(v.value);
      _notifyTeachersOfChange_(author + '님이 게시판 댓글을 수정했어요.', 'board-comment-edit-' + commentId, _okguDeepLink('board', String(data[i][1]), commentId));
      return _ok();
    }
  }
  return _err('수정할 댓글을 찾을 수 없어요', 'E_NOT_FOUND');
}
function deleteComment(author, commentId) {
  const sheet = getSheet('게시판댓글');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === commentId) {
      if (String(data[i][2]) !== author) return _err('본인 댓글만 삭제할 수 있어요', 'E_FORBIDDEN');
      const postId = String(data[i][1]);
      sheet.deleteRow(i + 1);
      _notifyTeachersOfChange_(author + '님이 게시판 댓글을 삭제했어요.', 'board-comment-delete-' + commentId, _okguDeepLink('board', postId));
      return _ok();
    }
  }
  return _err('댓글을 찾을 수 없어요', 'E_NOT_FOUND');
}
// =============================================
// ===== 칭찬함 =====
// =============================================
function sendPraise(from, to, msg, anonymous) {
  if (!String(to || '').trim()) return _err('받는 사람을 선택해주세요', 'E_EMPTY');
  const v = _validateText(msg, '칭찬 메시지', 300);
  if (v.error) return v.error;
  const sheet = getSheet('칭찬메시지');
  // 9열: ID, 보낸사람(실명 원장), 받는사람, 메시지, 작성시간, 읽음, 익명여부, 숨김여부, 승인상태
  // 승인상태: 'pending' | 'approved' | 'rejected'
  const id = 'p_' + Date.now();
  const target = String(to).trim();
  sheet.appendRow([
    id,
    from,
    target,
    v.value,
    new Date().toISOString(),
    false,
    !!anonymous,
    false,
    'pending'
  ]);
  try {
    _sendPushToTeachers(
      'OKGU DIARY',
      from + '님이 칭찬 메시지를 보냈어요. 승인해 주세요.',
      'praise-review-' + id,
      OKGU_APP_URL
    );
  } catch(e) {}
  return _ok();
}
// 승인상태 정규화 (기존 데이터 호환: 빈값/true 등은 'approved'로 처리)
function _praiseStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'pending')  return 'pending';
  if (s === 'rejected') return 'rejected';
  return 'approved'; // 빈값, 'approved', 기타 모두 기존 승인된 것으로 처리
}
function getPraise(studentName) {
  const sheet = getSheet('칭찬메시지');
  const data  = sheet.getDataRange().getValues();
  const received = [], sent = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    const anon   = r[6] === true || r[6] === 'TRUE' || r[6] === 'true';
    const hidden = r[7] === true || r[7] === 'TRUE' || r[7] === 'true';
    const status = _praiseStatus(r[8]);
    if (hidden) continue; // 교사가 숨긴 메시지는 학생에게 안 보임
    // 받은 칭찬: 승인된 것만 보임
    if (r[2] === studentName && status === 'approved') {
      received.push({
        id: r[0],
        from: anon ? '익명의 친구' : r[1],
        to: r[2], msg: r[3],
        time: _fmtTime(_isoStr(r[4])), read: r[5],
        anonymous: anon,
        status: status
      });
    }
    // 보낸 칭찬: 모든 상태 표시 (pending/approved/rejected)
    if (r[1] === studentName) {
      sent.push({
        id: r[0], from: r[1], to: r[2], msg: r[3],
        time: _fmtTime(_isoStr(r[4])), read: r[5],
        anonymous: anon,
        status: status
      });
    }
  }
  // 읽음 처리: 승인된 받은 칭찬만 읽음 처리
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (r[2] === studentName && !r[5] && _praiseStatus(r[8]) === 'approved')
      sheet.getRange(i + 1, 6).setValue(true);
  }
  return { received: received.reverse(), sent: sent.reverse() };
}
// ── 교사 검열 ──
function listAllPraiseForTeacher(token) {
  const payload = _requireTeacher(token);
  if (!payload) return _err('선생님만 사용할 수 있어요', 'E_AUTH');
  const sheet = getSheet('칭찬메시지');
  const data  = sheet.getDataRange().getValues();
  const items = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    items.push({
      id: r[0], from: r[1], to: r[2], msg: r[3],
      time: _fmtTime(_isoStr(r[4])), read: !!r[5],
      anonymous: r[6] === true || r[6] === 'TRUE' || r[6] === 'true',
      hidden:    r[7] === true || r[7] === 'TRUE' || r[7] === 'true',
      status:    _praiseStatus(r[8])
    });
  }
  return _ok({ items: items.reverse() });
}
// 교사: 칭찬 승인/거절
function setPraiseStatus(token, praiseId, status) {
  const payload = _requireTeacher(token);
  if (!payload) return _err('선생님만 사용할 수 있어요', 'E_AUTH');
  if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
    return _err('잘못된 상태값', 'E_PARAM');
  }
  const sheet = getSheet('칭찬메시지');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(praiseId)) {
      sheet.getRange(i + 1, 9).setValue(status);
      if (status === 'approved') {
        try {
          const toName = String(data[i][2] || '').trim();
          const fromName = String(data[i][1] || '').trim();
          const targets = toName === '담임' ? _getTeacherNames() : [toName];
          _sendPushToNames(
            targets,
            'OKGU DIARY',
            fromName + '님이 보낸 칭찬이 도착했어요.',
            'praise-' + praiseId,
            _okguDeepLink('praise', praiseId)
          );
        } catch(e) {}
      }
      return _ok({ status: status });
    }
  }
  return _err('메시지를 찾을 수 없어요', 'E_NOTFOUND');
}
function setPraiseHidden(token, praiseId, hide) {
  const payload = _requireTeacher(token);
  if (!payload) return _err('선생님만 사용할 수 있어요', 'E_AUTH');
  const sheet = getSheet('칭찬메시지');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(praiseId)) {
      sheet.getRange(i + 1, 8).setValue(!!hide);
      return _ok({ hidden: !!hide });
    }
  }
  return _err('메시지를 찾을 수 없어요', 'E_NOTFOUND');
}
function deletePraiseAsTeacher(token, praiseId) {
  const payload = _requireTeacher(token);
  if (!payload) return _err('선생님만 사용할 수 있어요', 'E_AUTH');
  const sheet = getSheet('칭찬메시지');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(praiseId)) {
      sheet.deleteRow(i + 1);
      return _ok();
    }
  }
  return _err('메시지를 찾을 수 없어요', 'E_NOTFOUND');
}
// =============================================
// ===== 학생용 배치 로드 (게시판 댓글 포함) =====
// =============================================
function getStudentDashboard(token, studentName) {
  const _p = _verifyToken(token);
  if (!_p || (_p.role !== '선생님' && _p.name !== studentName)) return { entries: [], teacherCommentMap: {} };
  const entrySheet   = getSheet('일기기록');
  const commentSheet = _ensureTeacherCommentParentColumn_();
  const boardCommentSheet = getSheet('게시판댓글'); 
  const allEntries  = entrySheet.getDataRange().getValues().slice(1);
  const allComments = commentSheet.getDataRange().getValues().slice(1).filter(r => r[0]);
  const allBoardComments = boardCommentSheet.getDataRange().getValues().slice(1).filter(r => r[0]);
  // 내 일기 ID 목록
  const myEntryIds = allEntries
    .filter(r => r[0] && String(r[2]).trim() === studentName)
    .map(r => String(r[0]));
  // 선생님 댓글 맵
  const tcMap = {};
  allComments
    .filter(c => myEntryIds.includes(String(c[1])))
    .forEach(c => {
      const did = String(c[1]);
      if (!tcMap[did]) tcMap[did] = [];
      const t = _isoStr(c[4]);
      tcMap[did].push({
        id: String(c[0]),
        teacher: c[2],
        text: c[3],
        time: _fmtTime(t),
        timeHM: _fmtHM(t),
        role: String(c[5]||'선생님').trim(),
        parentId: String(c[6] || ''),
        timestamp: new Date(t).getTime() || 0
      });
    });
  Object.keys(tcMap).forEach(function(did) {
    tcMap[did].sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
    _attachFallbackTeacherReplyParents_(tcMap[did]);
  });
  // 게시판 댓글 맵 (친구들)
  const bcMap = {};
  allBoardComments
    .filter(c => myEntryIds.includes(String(c[1])))
    .forEach(c => {
      const did = String(c[1]);
      if (!bcMap[did]) bcMap[did] = [];
      bcMap[did].push({ id: String(c[0]), author: c[2], text: c[3], time: _fmtTime(_isoStr(c[4])), timeHM: _fmtHM(_isoStr(c[4])) });
    });
  // 내 일기 목록 (오래된 순 정렬)
  const entries = allEntries
    .filter(r => r[0] && String(r[2]).trim() === studentName)
    .map(r => {
      let photos = [];
      try { photos = JSON.parse(r[11] || '[]'); } catch(e) {}
      const savedIso = _isoStr(r[10]);
      return {
        id:          String(r[0]),
        date:        _rowDate(r[1]),
        studentName: String(r[2]).trim(),
        moodEmoji:   r[3], moodLabel: r[4], moodColor: r[5],
        text:        r[6],
        isSecret:    r[7], isPublic: r[8], isMeOnly: r[9],
        savedAt:     _fmtTime(savedIso),
        savedTime:   _fmtDatetimeKr(savedIso),
        timeHM:      _fmtHM(savedIso),
        timestamp:   new Date(savedIso).getTime(),
        photos,
        teacherComments: tcMap[String(r[0])] || [],
        boardComments: bcMap[String(r[0])] || []
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
  return { entries, teacherCommentMap: tcMap };
}
function getMyEntries(token, studentName) {
  return getStudentDashboard(token, studentName).entries;
}
// =============================================
// ===== 교사 전용 API =====
// =============================================
function getRecentEntries(token, limit, offset) {
  if (!_requireTeacher(token)) return [];
  const entrySheet   = getSheet('일기기록');
  const commentSheet = _ensureTeacherCommentParentColumn_();
  const data        = entrySheet.getDataRange().getValues().slice(1).filter(r => r[0]);
  const commentData = commentSheet.getDataRange().getValues().slice(1).filter(r => r[0]);
  const start = Math.max(0, Number(offset) || 0);
  const size  = Math.max(1, Math.min(Number(limit) || 12, 50));
  data.sort((a, b) => {
    const ta = a[10] ? new Date(_isoStr(a[10])).getTime() : 0;
    const tb = b[10] ? new Date(_isoStr(b[10])).getTime() : 0;
    return tb - ta;
  });
  const page = data.slice(start, start + size);
  const pageIds = {};
  page.forEach(r => { pageIds[String(r[0])] = true; });
  const commentMap = {};
  commentData.forEach(c => {
    const diaryId = String(c[1]);
    if (!pageIds[diaryId]) return;
    if (!commentMap[diaryId]) commentMap[diaryId] = [];
    const t = _isoStr(c[4]);
    commentMap[diaryId].push({
      id: String(c[0]),
      teacher: c[2],
      text: c[3],
      time: _fmtTime(t),
      timeHM: _fmtHM(t),
      role: String(c[5] || '선생님').trim(),
      parentId: String(c[6] || ''),
      timestamp: new Date(t).getTime() || 0
    });
  });
  Object.keys(commentMap).forEach(id => {
    commentMap[id].sort((a, b) => a.timestamp - b.timestamp);
    _attachFallbackTeacherReplyParents_(commentMap[id]);
  });
  const entries = page.map(r => {
    let photos = [];
    try { photos = JSON.parse(r[11] || '[]'); } catch(e) {}
    const diaryId  = String(r[0]);
    const savedIso = _isoStr(r[10]);
    return {
      id:          diaryId,
      date:        _rowDate(r[1]),
      studentName: String(r[2]).trim(),
      moodEmoji:   r[3], moodLabel: r[4], moodColor: r[5],
      text:        r[6],
      isSecret:    r[7], isPublic: r[8], isMeOnly: r[9],
      savedAt:     _fmtTime(savedIso),
      savedTime:   _fmtDatetimeKr(savedIso),
      photos,
      timeHM:      _fmtHM(savedIso),
      teacherComments: commentMap[diaryId] || []
    };
  });
  return entries;
}
function getClassOverview(token) {
  if (!_requireTeacher(token)) return [];
  const studentSheet = getSheet('학생계정');
  const entrySheet   = getSheet('일기기록');
  const students   = studentSheet.getDataRange().getValues().slice(1).filter(r => r[0] && String(r[2]).trim() !== '선생님');
  const allEntries = entrySheet.getDataRange().getValues().slice(1).filter(r => r[0]);
  const todayStr   = getTodayKey();
  return students.map(s => {
    const name = String(s[0]).trim();
    const myE  = allEntries.filter(r => String(r[2]).trim() === name);
    const wroteToday = myE.some(r => _rowDate(r[1]) === todayStr);
    let streak = 0;
    const d = new Date();
    while (true) {
      const k = _dateKey(d);
      if (myE.some(r => _rowDate(r[1]) === k)) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    const sorted   = myE.slice().sort((a, b) => String(_rowDate(b[1])).localeCompare(String(_rowDate(a[1]))));
    const lastMood = sorted.length ? sorted[0][3] : '';
    const lastDate = sorted.length ? _rowDate(sorted[0][1]) : '';
    return { name, wroteToday, streak, lastMood, lastDate, totalDays: myE.length };
  });
}
function getClassMoodStats(token, period) {
  if (!_requireTeacher(token)) return { counts: {}, total: 0 };
  const entries  = getSheet('일기기록').getDataRange().getValues().slice(1).filter(r => r[0]);
  const now      = new Date();
  const todayStr = getTodayKey();
  const filtered = entries.filter(r => {
    const dk = _rowDate(r[1]);
    if (!dk) return false;
    if (period === 'today') return dk === todayStr;
    if (period === 'week') {
      const dt  = new Date(dk);
      const day = now.getDay() || 7;
      const mon = new Date(now); mon.setDate(now.getDate() - day + 1); mon.setHours(0,0,0,0);
      return dt >= mon;
    }
    if (period === 'month') {
      const dt = new Date(dk);
      return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
    }
    return true;
  });
  const counts = {};
  filtered.forEach(r => { if (r[3]) counts[r[3]] = (counts[r[3]] || 0) + 1; });
  return { counts, total: filtered.length };
}
function getStudentEntries(token, studentName) {
  if (!_requireTeacher(token)) return [];
  const sheet        = getSheet('일기기록');
  const commentSheet = _ensureTeacherCommentParentColumn_();
  const data         = sheet.getDataRange().getValues().slice(1).filter(r => r[0]);
  const commentData  = commentSheet.getDataRange().getValues().slice(1).filter(r => r[0]);
  return data
    .filter(r => String(r[2]).trim() === studentName && !r[9])
    .map(r => {
      let photos = [];
      try { photos = JSON.parse(r[11] || '[]'); } catch(e) {}
      const diaryId  = String(r[0]);
      const savedIso = _isoStr(r[10]);
      return {
        id:          diaryId,
        date:        _rowDate(r[1]),
        studentName: String(r[2]).trim(),
        moodEmoji:   r[3], moodLabel: r[4], moodColor: r[5],
        text:        r[6],
        isSecret:    r[7], isPublic: r[8], isMeOnly: r[9],
        savedAt:     _fmtTime(savedIso),
        savedTime:   _fmtDatetimeKr(savedIso),
        timeHM:      _fmtHM(savedIso),
        photos,
        teacherComments: commentData
          .filter(c => String(c[1]) === diaryId)
          .map(c => ({ id: String(c[0]), teacher: c[2], text: c[3], time: _fmtTime(_isoStr(c[4])), timeHM: _fmtHM(_isoStr(c[4])), role: String(c[5]||'선생님').trim(), parentId: String(c[6] || '') }))
      };
    })
    .reverse();
}
function addTeacherComment(token, diaryId, text) {
  const payload = _requireTeacher(token);
  if (!payload) return _err('선생님만 사용할 수 있어요', 'E_AUTH');
  if (!diaryId) return _err('대상 일기를 찾을 수 없어요', 'E_PARAM');
  const v = _validateText(text, '선생님 댓글', 1000);
  if (v.error) return v.error;
  const teacherName = payload.name;
  const roleStr = _getRole(teacherName);
  const sheet = _ensureTeacherCommentParentColumn_();
  const dup = _findRecentDuplicateRow_(sheet, function(r) {
    return String(r[1]) === String(diaryId) &&
      String(r[2]) === String(teacherName) &&
      String(r[3]) === String(v.value) &&
      String(r[6] || '') === '';
  }, 4, 8000);
  if (dup) return _ok({ id: dup.id, time: '방금', duplicate: true });

  const id = 'tc_' + Date.now();
  sheet.appendRow([id, diaryId, teacherName, v.value, new Date().toISOString(), roleStr, '']);
  try {
    const owner = _getDiaryOwner(diaryId);
    if (owner && owner !== teacherName) {
      _sendPushToNames(
        [owner],
        'OKGU DIARY',
        teacherName + ' 선생님이 일기에 댓글을 남겼어요.',
        'teacher-comment-' + id,
        _okguDeepLink('diary', diaryId, id)
      );
    }
  } catch(e) {}
  return _ok({ id, time: '방금' });
}
function addStudentReplyToDiary(diaryId, studentName, text, parentCommentId) {
  if (!diaryId || !studentName) return _err('필수 정보가 없어요', 'E_PARAM');
  const v = _validateText(text, '대댓글', 500);
  if (v.error) return v.error;
  const parent = parentCommentId ? String(parentCommentId) : '';
  const sheet = _ensureTeacherCommentParentColumn_();
  const dup = _findRecentDuplicateRow_(sheet, function(r) {
    return String(r[1]) === String(diaryId) &&
      String(r[2]) === String(studentName) &&
      String(r[3]) === String(v.value) &&
      String(r[5] || '') === '학생' &&
      String(r[6] || '') === parent;
  }, 4, 8000);
  if (dup) return _ok({ id: dup.id, time: '방금', parentId: parent, duplicate: true });

  const id = 'tc_' + Date.now();
  sheet.appendRow([id, diaryId, studentName, v.value, new Date().toISOString(), '학생', parent]);
  try {
    const teacherName = parent ? _getTeacherCommentAuthor_(parent) : '';
    const targets = teacherName ? [teacherName] : _getTeacherNames();
    _sendPushToNames(
      targets,
      'OKGU DIARY',
      studentName + '님이 선생님 댓글에 답글을 남겼어요.',
      'teacher-reply-' + id,
      _okguDeepLink('diary', diaryId, id)
    );
    _notifyTeachersOfChange_(
      studentName + '님이 선생님 댓글에 답글을 남겼어요.',
      'teacher-all-reply-' + id,
      _okguDeepLink('diary', diaryId, id)
    );
  } catch(e) {}
  return _ok({ id, time: '방금', parentId: parent });
}

// ─────────────────────────────────────────────
// 인앱 알림: 최근 7일 새 댓글·칭찬 목록
// ─────────────────────────────────────────────
function getNotifications(userName, role) {
  if (!userName) return _err('사용자 정보 없음', 'E_PARAM');
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const results = [];

  if (role !== '선생님') {
    // 학생: 선생님 댓글 + 칭찬
    const entrySheet   = getSheet('일기기록');
    const commentSheet = _ensureTeacherCommentParentColumn_();
    const praiseSheet  = getSheet('칭찬메시지');

    const myEntryRows = entrySheet.getDataRange().getValues().slice(1)
      .filter(r => r[0] && String(r[2]).trim() === userName);
    const myIdSet  = new Set(myEntryRows.map(r => String(r[0])));

    // 선생님이 단 댓글 (role 컬럼 != '학생')
    commentSheet.getDataRange().getValues().slice(1)
      .filter(r => r[0] && myIdSet.has(String(r[1])) && String(r[5]||'').trim() !== '학생')
      .forEach(r => {
        const t = _isoStr(r[4]);
        if (!t || new Date(t).getTime() < cutoff.getTime()) return;
        results.push({
          type: 'comment',
          id: String(r[0]),
          diaryId: String(r[1]),
          from: String(r[2]),
          text: String(r[3]).substring(0, 60),
          timeISO: String(t),
          timeLabel: _fmtTime(t)
        });
      });

    // 게시판: 내가 쓴 공개글에 달린 다른 사람 댓글
    const boardSheet = getSheet('게시판');
    const boardCommentSheet = getSheet('게시판댓글');
    const myPostIds = new Set(
      boardSheet.getDataRange().getValues().slice(1)
        .filter(r => r[0] && String(r[1]).trim() === userName)
        .map(r => String(r[0]))
    );
    boardCommentSheet.getDataRange().getValues().slice(1)
      .filter(r => r[0] && myPostIds.has(String(r[1])) && String(r[2]).trim() !== userName)
      .forEach(r => {
        const t = _isoStr(r[4]);
        if (!t || new Date(t).getTime() < cutoff.getTime()) return;
        results.push({
          type: 'board',
          id: String(r[0]),
          postId: String(r[1]),
          from: String(r[2]),
          text: String(r[3]).substring(0, 60),
          timeISO: String(t),
          timeLabel: _fmtTime(t)
        });
      });

    // 칭찬 (승인된 것, 숨기지 않은 것)
    praiseSheet.getDataRange().getValues().slice(1)
      .filter(r => r[0] && String(r[2]).trim() === userName
               && _praiseStatus(r[8]) === 'approved'
               && !(r[7] === true || r[7] === 'TRUE' || r[7] === 'true'))
      .forEach(r => {
        const t = _isoStr(r[4]);
        if (!t || new Date(t).getTime() < cutoff.getTime()) return;
        const anon = r[6] === true || r[6] === 'TRUE' || r[6] === 'true';
        results.push({
          type: 'praise',
          id: String(r[0]),
          diaryId: '',
          from: anon ? '익명' : String(r[1]),
          text: String(r[3]).substring(0, 60),
          timeISO: String(t),
          timeLabel: _fmtTime(t)
        });
      });

  } else {
    // 선생님: 학생 대댓글 (role === '학생')
    const commentSheet = _ensureTeacherCommentParentColumn_();
    commentSheet.getDataRange().getValues().slice(1)
      .filter(r => r[0] && String(r[5]||'').trim() === '학생')
      .forEach(r => {
        const t = _isoStr(r[4]);
        if (!t || new Date(t).getTime() < cutoff.getTime()) return;
        results.push({
          type: 'reply',
          id: String(r[0]),
          diaryId: String(r[1]),
          from: String(r[2]),
          text: String(r[3]).substring(0, 60),
          timeISO: String(t),
          timeLabel: _fmtTime(t)
        });
      });
  }

  results.sort((a, b) => new Date(b.timeISO) - new Date(a.timeISO));
  return _ok({ items: results.slice(0, 30) });
}

function _getRole(name) {
  const data = getSheet('학생계정').getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === name) return String(data[i][2]).trim();
  }
  return '학생';
}
function deleteTeacherComment(token, commentId) {
  const payload = _requireTeacher(token);
  if (!payload) return _err('선생님만 사용할 수 있어요', 'E_AUTH');
  const teacherName = payload.name;
  const sheet = _ensureTeacherCommentParentColumn_();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === commentId) {
      if (String(data[i][2]) !== teacherName) return _err('본인 댓글만 삭제할 수 있어요', 'E_PERM');
      sheet.deleteRow(i + 1);
      return _ok();
    }
  }
  return _err('댓글을 찾을 수 없어요', 'E_NOTFOUND');
}
function editTeacherComment(token, commentId, newText) {
  const payload = _requireTeacher(token);
  if (!payload) return _err('선생님만 사용할 수 있어요', 'E_AUTH');
  const teacherName = payload.name;
  const v = _validateText(newText, '선생님 댓글', 1000);
  if (v.error) return v.error;
  const sheet = _ensureTeacherCommentParentColumn_();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === commentId) {
      if (String(data[i][2]) !== teacherName) return _err('본인 댓글만 수정할 수 있어요', 'E_PERM');
      sheet.getRange(i + 1, 4).setValue(v.value);
      return _ok();
    }
  }
  return _err('수정할 댓글을 찾을 수 없어요', 'E_NOTFOUND');
}

// =============================================
// ===== 교사 대시보드 강화 (#6) =====
// =============================================
// ── 상담 필요 태그 ──
function listStudentFlags(token) {
  const payload = _requireTeacher(token);
  if (!payload) return _err('선생님만 사용할 수 있어요', 'E_AUTH');
  const sheet = getSheet('학생태그');
  const data  = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < data.length; i++) {
    const nm = String(data[i][0] || '').trim();
    if (!nm) continue;
    map[nm] = {
      counsel: data[i][1] === true || data[i][1] === 'TRUE' || data[i][1] === 'true',
      memo:    String(data[i][2] || ''),
      by:      String(data[i][3] || ''),
      at:      _isoStr(data[i][4])
    };
  }
  return _ok({ flags: map });
}
function setStudentCounselFlag(token, studentName, need, memo) {
  const payload = _requireTeacher(token);
  if (!payload) return _err('선생님만 사용할 수 있어요', 'E_AUTH');
  const nm = String(studentName || '').trim();
  if (!nm) return _err('학생 이름이 필요해요', 'E_PARAM');
  // 메모는 선택사항 (해제 시/지정 시 모두 빈 값 허용). 입력된 경우만 길이·XSS 검증.
  let memoVal = '';
  const rawMemo = String(memo == null ? '' : memo);
  if (rawMemo.trim()) {
    const mv = _validateText(rawMemo, '메모', 500);
    if (mv.error) return mv.error;  // 중첩 객체 버그 수정 (이미 _err 응답임)
    memoVal = mv.value;
  }
  const sheet = getSheet('학생태그');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === nm) {
      sheet.getRange(i + 1, 2, 1, 4).setValues([[!!need, memoVal, payload.name, new Date().toISOString()]]);
      return _ok();
    }
  }
  sheet.appendRow([nm, !!need, memoVal, payload.name, new Date().toISOString()]);
  return _ok();
}

// ── 감정 변화 추이 (일자별 평균 기분 점수) ──
// 기분 점수: 😄=5, 🙂=4, 😐=3, 😢=2, 😠=1
function getMoodTrend(token, period) {
  const payload = _requireTeacher(token);
  if (!payload) return _err('선생님만 사용할 수 있어요', 'E_AUTH');
  const scoreMap = { '😄':5,'🙂':4,'😐':3,'😢':2,'😠':1 };
  const now = new Date();
  let days = 7;
  if (period === 'month') days = 30;
  else if (period === 'week') days = 7;
  const fromKey = Utilities.formatDate(new Date(now.getTime() - (days - 1) * 86400000), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const sheet = getSheet('일기기록');
  const data  = sheet.getDataRange().getValues();
  const buckets = {}; // date → {sum, n}
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    const d = Utilities.formatDate(new Date(r[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (d < fromKey) continue;
    const emoji = String(r[3] || '');
    const sc = scoreMap[emoji];
    if (!sc) continue;
    if (!buckets[d]) buckets[d] = { sum:0, n:0, emojis:{} };
    buckets[d].sum += sc;
    buckets[d].n   += 1;
    buckets[d].emojis[emoji] = (buckets[d].emojis[emoji] || 0) + 1;
  }
  // 연속된 날짜 배열 생성
  const out = [];
  for (let k = days - 1; k >= 0; k--) {
    const dkey = Utilities.formatDate(new Date(now.getTime() - k * 86400000), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const b = buckets[dkey];
    out.push({
      date: dkey,
      avg:  b ? Math.round((b.sum / b.n) * 100) / 100 : null,
      count: b ? b.n : 0
    });
  }
  return _ok({ period: period || 'week', points: out });
}

// ── 학급 기분 통계 CSV 내보내기 (Excel에서 열림) ──
function exportMoodStatsCsv(token, period) {
  const payload = _requireTeacher(token);
  if (!payload) return _err('선생님만 사용할 수 있어요', 'E_AUTH');
  const tr = getMoodTrend(token, period || 'month');
  if (!tr.success) return tr;
  const rows = [['날짜','평균점수(1~5)','작성건수']];
  tr.points.forEach(p => rows.push([p.date, p.avg == null ? '' : p.avg, p.count]));
  // CSV string (UTF-8 BOM 포함 → Excel 한글 깨짐 방지)
  const csv = '\uFEFF' + rows.map(r =>
    r.map(c => {
      const s = String(c == null ? '' : c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')
  ).join('\r\n');
  const filename = '학급기분통계_' + (period || 'month') + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '.csv';
  return _ok({ csv: csv, filename: filename });
}


// ===== OKGU DIARY Web Push functions =====
const PUSH_SERVER_URL = 'https://okgu-push-server030.vercel.app';
const PUSH_SECRET = 'REDACTED';
const OKGU_APP_URL = 'https://rlasksk030.github.io/okgu-diary-alarm-/';

function _okguDeepLink(type, id, commentId) {
  return OKGU_APP_URL.replace(/\/$/, '') +
    '/?open=' + encodeURIComponent(type || '') +
    (id ? '&id=' + encodeURIComponent(String(id)) : '') +
    (commentId ? '&cid=' + encodeURIComponent(String(commentId)) : '');
}

function _notifyTeachersOfChange_(body, tag, url) {
  try {
    return _sendPushToTeachers('OKGU DIARY', body, tag, url || OKGU_APP_URL);
  } catch(e) {
    return _err(e.message, 'E_PUSH');
  }
}

function _getPushSheet() {
  const ss = _getSS();
  let sheet = ss.getSheetByName('푸시구독');
  if (!sheet) sheet = ss.insertSheet('푸시구독');

  const headers = ['이름','역할','Endpoint','SubscriptionJSON','등록시간','활성'];
  const lastCol = Math.max(sheet.getLastColumn(), headers.length);
  const cur = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let changed = false;
  headers.forEach(function(h, i) {
    if (cur[i] !== h) {
      sheet.getRange(1, i + 1).setValue(h).setFontWeight('bold');
      changed = true;
    }
  });
  return sheet;
}

function savePushSubscription(token, name, role, subscriptionJson) {
  const p = _verifyToken(token);
  if (!p || p.name !== name) return _err('로그인이 필요해요', 'E_AUTH');

  let sub;
  try { sub = JSON.parse(subscriptionJson); }
  catch(e) { return _err('푸시 구독 정보가 올바르지 않아요', 'E_PARAM'); }

  if (!sub || !sub.endpoint) return _err('푸시 endpoint가 없어요', 'E_PARAM');

  const sheet = _getPushSheet();
  const data = sheet.getDataRange().getValues();
  const endpoint = String(sub.endpoint);
  const row = [p.name, p.role || role || '', endpoint, JSON.stringify(sub), new Date().toISOString(), true];

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]) === endpoint || String(data[i][0]).trim() === p.name) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return _ok();
    }
  }

  sheet.appendRow(row);
  return _ok();
}

function getMyPushStatus(token) {
  const p = _verifyToken(token);
  if (!p) return _err('로그인이 필요해요', 'E_AUTH');

  const data = _getPushSheet().getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][0] || '').trim();
    const active = data[i][5] === true || data[i][5] === 'TRUE' || data[i][5] === 'true';
    if (name !== p.name || !active) continue;
    try {
      const sub = JSON.parse(data[i][3] || '{}');
      if (sub && sub.endpoint) return _ok({ enabled: true });
    } catch(e) {}
  }
  return _ok({ enabled: false });
}

function disablePushSubscription(token) {
  const p = _verifyToken(token);
  if (!p) return _err('로그인이 필요해요', 'E_AUTH');

  const sheet = _getPushSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === p.name) {
      sheet.getRange(i + 1, 6).setValue(false);
    }
  }
  return _ok({ enabled: false });
}

function getPushSubscriptionStatus(token) {
  const payload = _requireTeacher(token);
  if (!payload) return _err('선생님 권한이 필요해요', 'E_AUTH');

  const accountData = getSheet('학생계정').getDataRange().getValues();
  const students = [];
  for (let i = 1; i < accountData.length; i++) {
    const name = String(accountData[i][0] || '').trim();
    const role = String(accountData[i][2] || '').trim();
    if (name && role !== '선생님') students.push(name);
  }

  const activeMap = {};
  const pushData = _getPushSheet().getDataRange().getValues();
  for (let i = 1; i < pushData.length; i++) {
    const name = String(pushData[i][0] || '').trim();
    const active = pushData[i][5] === true || pushData[i][5] === 'TRUE' || pushData[i][5] === 'true';
    if (!name || !active) continue;
    try {
      const sub = JSON.parse(pushData[i][3] || '{}');
      if (sub && sub.endpoint) activeMap[name] = true;
    } catch(e) {}
  }

  const items = students.map(function(name) {
    return { name: name, enabled: !!activeMap[name] };
  });
  const enabled = items.filter(function(x) { return x.enabled; }).length;
  return _ok({ items: items, enabled: enabled, total: items.length });
}

function sendTestPush(token) {
  const p = _verifyToken(token);
  if (!p) return _err('로그인이 필요해요', 'E_AUTH');

  return _sendPushToNames(
    [p.name],
    'OKGU DIARY 푸시 테스트',
    p.name + '님, 진짜 푸시 알림이 정상 도착했어요.',
    'test-' + Date.now(),
    OKGU_APP_URL
  );
}

function _sendPushToTeachers(title, body, tag, url) {
  const teachers = _getTeacherNames();
  return _sendPushToNames(teachers, title, body, tag, url || OKGU_APP_URL);
}

function _sendPushToNames(names, title, body, tag, url) {
  names = (names || []).map(String).filter(Boolean);
  if (!names.length) return _ok({ sent: 0 });

  const sheet = _getPushSheet();
  const data = sheet.getDataRange().getValues();
  const wanted = {};
  names.forEach(function(n) { wanted[String(n).trim()] = true; });

  const subscriptions = [];
  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][0] || '').trim();
    const active = data[i][5] === true || data[i][5] === 'TRUE' || data[i][5] === 'true';
    if (!wanted[name] || !active) continue;
    try {
      const sub = JSON.parse(data[i][3]);
      if (sub && sub.endpoint) subscriptions.push(sub);
    } catch(e) {}
  }

  if (!subscriptions.length) return _ok({ sent: 0, msg: '등록된 푸시 기기가 없어요' });
  return _callPushServer(subscriptions, title, body, tag, url || OKGU_APP_URL, _pushBadgeCountForNames_(names));
}

function _pushBadgeCountForNames_(names) {
  let maxCount = 1;
  (names || []).forEach(function(name) {
    try {
      const n = String(name || '').trim();
      if (!n) return;
      const role = _getRole(n);
      const res = getNotifications(n, role);
      const count = res && res.success && Array.isArray(res.items) ? res.items.length : 1;
      if (count > maxCount) maxCount = count;
    } catch(e) {}
  });
  return Math.max(1, maxCount);
}

function _callPushServer(subscriptions, title, body, tag, url, badgeCount) {
  if (!PUSH_SERVER_URL || PUSH_SERVER_URL.indexOf('YOUR-VERCEL-APP') >= 0) {
    return _err('PUSH_SERVER_URL을 Vercel 주소로 바꿔주세요', 'E_PUSH_CONFIG');
  }

  try {
    const resp = UrlFetchApp.fetch(PUSH_SERVER_URL.replace(/\/$/, '') + '/api/send-push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + PUSH_SECRET },
      payload: JSON.stringify({
        subscriptions: subscriptions,
        title: title || 'OKGU DIARY',
        body: body || '새 알림이 있어요.',
        tag: tag || ('okgu-' + Date.now()),
        url: url || OKGU_APP_URL,
        icon: 'okgu_icon.png',
        badgeCount: Math.max(1, Number(badgeCount || 1) || 1)
      }),
      muteHttpExceptions: true
    });

    const text = resp.getContentText();
    let result = {};
    try { result = JSON.parse(text); } catch(e) { result = { raw: text }; }
    if (resp.getResponseCode() >= 300) return _err('푸시 서버 오류: ' + text, 'E_PUSH');
    return _ok(result);
  } catch(e) {
    return _err('푸시 전송 실패: ' + e.message, 'E_PUSH');
  }
}

// UrlFetchApp.fetch 권한 승인이 필요할 때 Apps Script에서 이 함수를 한 번 실행하세요.
function authorizePushOnce() {
  const resp = UrlFetchApp.fetch(PUSH_SERVER_URL.replace(/\/$/, '') + '/api/send-push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + PUSH_SECRET },
    payload: JSON.stringify({
      subscriptions: [],
      title: 'OKGU DIARY',
      body: '권한 승인 테스트',
      tag: 'auth-test',
      url: OKGU_APP_URL
    }),
    muteHttpExceptions: true
  });
  Logger.log(resp.getResponseCode());
  Logger.log(resp.getContentText());
}

function _getTeacherNames() {
  const data = getSheet('학생계정').getDataRange().getValues();
  const out = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2] || '').trim() === '선생님') out.push(String(data[i][0]).trim());
  }
  return out;
}

function _getDiaryOwner(entryId) {
  const data = getSheet('일기기록').getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(entryId)) return String(data[i][2]).trim();
  }
  return '';
}

function _getBoardAuthor(postId) {
  const data = getSheet('게시판').getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(postId)) return String(data[i][1]).trim();
  }
  return '';
}

function _getBoardCommentAuthor_(commentId) {
  const sheet = _ensureBoardCommentParentColumn_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(commentId)) return String(data[i][2]).trim();
  }
  return '';
}

function _getTeacherCommentAuthor_(commentId) {
  const sheet = _ensureTeacherCommentParentColumn_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(commentId)) return String(data[i][2]).trim();
  }
  return '';
}


// ===== OKGU DIARY: 밤 10시 자동 진짜 푸시 =====
// Code.gs 맨 아래에 붙여넣고, setupNightlyDiaryReminderTrigger()를 Apps Script에서 1번 실행하세요.

function setupNightlyDiaryReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction && trigger.getHandlerFunction() === 'scheduledDiaryReminderPush') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('scheduledDiaryReminderPush')
    .timeBased()
    .everyDays(1)
    .atHour(22)
    .nearMinute(0)
    .create();

  return '밤 10시 자동 일기 푸시 트리거를 설정했어요.';
}

function scheduledDiaryReminderPush() {
  const today = getTodayKey();
  const students = _getStudentNamesForReminder_();
  if (!students.length) return _ok({ sent: 0, msg: '학생 계정이 없어요' });

  const wroteMap = _getTodayWroteMap_(today);
  const targets = students.filter(function(name) {
    return !wroteMap[name];
  });

  if (!targets.length) {
    return _ok({ sent: 0, msg: '모든 학생이 오늘 일기를 썼어요' });
  }

  return _sendPushToNames(
    targets,
    'OKGU DIARY',
    '오늘 일기를 아직 쓰지 않았어요. 잠깐 기록해볼까요?',
    'daily-diary-reminder-' + today,
    OKGU_APP_URL
  );
}

// 지금 즉시 밤 10시 알림 로직을 시험 실행합니다. 실제 미작성 학생에게 푸시가 갑니다.
function testNightlyDiaryReminderPushNow() {
  return scheduledDiaryReminderPush();
}

function _getStudentNamesForReminder_() {
  const data = getSheet('학생계정').getDataRange().getValues();
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][0] || '').trim();
    const role = String(data[i][2] || '').trim();
    if (name && role !== '선생님') out.push(name);
  }
  return out;
}

function _getTodayWroteMap_(todayKeyValue) {
  const data = getSheet('일기기록').getDataRange().getValues();
  const map = {};
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const dateKey = _rowDate(data[i][1]);
    const name = String(data[i][2] || '').trim();
    if (name && dateKey === todayKeyValue) map[name] = true;
  }
  return map;
}
