# Nuxt 2 → Nuxt 3 (Vue2 → Vue3) 전환: 왜 해야 하고, 무엇이 좋아지는가

> 지식공유 자료 · [발표자] · [날짜]

## 목차

1. 왜 지금인가 — 지원 종료와 우리가 이미 겪는 문제
2. 무엇이 좋아지나 — 코드 구조 · 반응형 · 성능 · 타입
3. 우리 서비스 관점 — 뒤로가기 상태 유지
4. 어떻게 전환하나 — 바뀌는 것과 단계별 방법

---

## 1. 왜 지금인가

### Vue2도, Nuxt 2도 공식 지원이 끝났다

| | 지원 종료일 |
|---|---|
| Vue 2 (2.7 포함) | 2023년 12월 31일 |
| Nuxt 2 | 2024년 6월 30일 |

| 영향 | 내용 |
|---|---|
| 보안 패치 없음 | 취약점이 발견돼도 더 이상 고쳐지지 않는다 |
| 생태계가 떠남 | 라이브러리 · Nuxt 모듈 새 버전은 Nuxt 3 기준 |
| 점점 커지는 비용 | 미룰수록 코드가 쌓여 전환이 어려워진다 |

### 우리가 이미 겪고 있는 문제 — 쓰고 싶은 라이브러리를 못 쓴다

지원 종료는 먼 이야기가 아니라, 지금 기능 품질과 성능을 막고 있다.

**Swiper (캐러셀)**
- Swiper의 공식 Vue 컴포넌트는 Vue3 전용이다.
- Vue2에서는 예전 버전용 래퍼에 묶여 있다.
- 그래서 최신 버전의 성능 개선과 새 기능을 받지 못한다.

**핀치줌 · 제스처**
- Vue2를 지원하는 라이브러리가 적다.
- 있어도 업데이트가 끊긴 경우가 많다.
- 결국 직접 구현하거나, 품질을 타협하게 된다.

---

## 2. 무엇이 좋아지나

### 한눈에 보는 차이

**① 개발 방식**

| 항목 | Nuxt 2 (Vue2) | Nuxt 3 (Vue3) | 무엇이 좋아지나 |
|---|---|---|---|
| 코드 구성 | 종류별로 나눠 씀 (Options API) | 기능별로 모아 씀 (Composition API) · 기존 방식도 가능 | 큰 화면도 읽고 고치기 쉬움 |
| 공통 기능 | mixin (섞어 넣기) | composable (함수로 꺼내 쓰기) | 공통 기능을 고칠 때 영향 범위가 명확 |
| 변경 감지 | 일부는 우회 코드(`$set`) 필요 | 대부분 자동 감지 (Proxy) | "화면이 안 바뀌어요" 류 버그 감소 |
| 데이터 조회 | `asyncData` · `fetch` | `useAsyncData` · `useFetch` (캐시 내장) | 중복 요청 감소, 뒤로가기 즉시 표시 |
| 상태 관리 | Vuex | Pinia | 보일러플레이트 감소, 타입 추론 |
| TypeScript | 별도 설정 · 추론 약함 | 기본 지원 | 오타 · 잘못된 값을 실행 전에 발견 |

**② 플랫폼 · 운영**

| 항목 | Nuxt 2 (Vue2) | Nuxt 3 (Vue3) | 무엇이 좋아지나 |
|---|---|---|---|
| 공식 지원 | 종료 (보안 패치 없음) | 지원 중 | 보안 · 호환성 리스크 해소 |
| 라이브러리 | 옛 버전에 묶임 (Swiper 등) | 최신 버전 사용 | 성능 개선 · 새 기능을 바로 적용 |
| 빌드 도구 | webpack | Vite | 코드 수정 후 반영 대기 시간 단축 |
| 서버 엔진 | Node 서버 | Nitro | 서버 결과물 경량화, 배포 선택지 확대 |
| 렌더링 방식 | 앱 전체가 한 가지 방식 | 페이지별 선택 (`routeRules`) | 페이지 성격에 맞춰 속도 최적화 |
| 인력 · 자료 | 새 자료 · 예제 감소 | 공식 문서 · 예제 대부분 | 채용 · 온보딩이 수월 |

### 코드 구성 — 종류별로 나누던 코드를 기능별로 모은다

Vue2는 `data` / `computed` / `methods`처럼 **종류별 칸**에 나눠 넣는다. 기능이 커지면 한 기능의 코드가
여러 칸에 흩어진다.

```js
// Nuxt 2 (Vue2) · Options API
export default {
  data() {
    return { count: 0 };
  },
  computed: {
    double() {
      return this.count * 2;
    },
  },
  methods: {
    inc() {
      this.count++;
    },
  },
};
```

Vue3의 Composition API(`<script setup>`)는 **기능 단위로** 모아 쓴다. Nuxt 3는 `ref`, `computed` 같은 것도
자동으로 import해준다.

```vue
<!-- Nuxt 3 (Vue3) · script setup -->
<script setup>
const count = ref(0);
const double = computed(() => count.value * 2);
const inc = () => count.value++;
</script>
```

기존 Options API도 그대로 쓸 수 있어서, **한 번에 다 바꿀 필요는 없다.** 새로 만드는 화면부터 적용하면 된다.

### 공통 기능 재사용 — mixin(섞어 넣기) 대신 composable(함수로 꺼내 쓰기)

여러 화면이 같이 쓰는 기능(목록 불러오기, 로그인 확인 등)을 묶어 두는 방법이 바뀐다.

| Vue2 · mixin | Vue3 · composable |
|---|---|
| 여러 mixin의 이름이 겹치면 조용히 덮어씀 | 필요한 값만 골라서 꺼내 씀 |
| `this.xxx`가 어디서 왔는지 추적이 어려움 | 값의 출처가 코드에 그대로 보임 |
| 재사용할수록 복잡해짐 | 평범한 함수라 테스트하기 쉬움 |

```js
// composables/useOrderList.js — Nuxt 3는 composables/ 폴더를 자동 import
export function useOrderList() {
  const list = ref([]);
  const loading = ref(false);

  async function reload() {
    loading.value = true;
    list.value = await $fetch("/api/orders");
    loading.value = false;
  }

  return { list, loading, reload };
}

// 사용하는 쪽 — 무엇을 가져오는지 명확
const { list, loading, reload } = useOrderList();
```

### 반응형 — 데이터가 바뀐 걸 알아채는 방식이 바뀐다

**반응형**은 데이터를 바꾸면 화면이 자동으로 바뀌는 것을 말한다. Vue3는 데이터 변경을 더 넓게 감지하는
방식(Proxy)으로 바뀌어서, Vue2에서 필요했던 우회 코드(`$set`)가 필요 없어진다.

```js
// Vue2 — 화면에 반영되지 않는 코드
this.list[0] = item;               // 배열 인덱스 대입
this.user.nickname = "새 값";       // (user에 원래 없던 속성이면) 새 속성 추가
// 우회 코드가 필요했음: this.$set(this.list, 0, item)

// Vue3 — 그냥 반영된다
list.value[0] = item;
user.nickname = "새 값";
```

**큰 데이터에서 특히 유리하다.**
- Vue2는 데이터를 넣는 순간 **객체 전체를 끝까지 돌면서** 모든 속성을 반응형으로 바꾼다. 큰 목록을 받으면
  이 변환 자체가 느리고 메모리를 많이 쓴다.
- Vue3는 **실제로 접근하는 부분만** 반응형으로 만든다.
- 반응형이 필요 없는 큰 데이터는 `shallowRef` / `markRaw`로 명시적으로 뺄 수 있다.

### 성능 — 프레임워크 차원에서 가벼워지는 세 가지

| 영역 | Nuxt 3 (Vue3)에서 달라지는 점 |
|---|---|
| 큰 데이터 | 실제로 쓰는 부분만 감시해서 큰 목록을 받아도 덜 무거움 |
| 다시 그리기 | 절대 안 바뀌는 부분은 미리 표시해 두고 다시 그릴 때 건너뜀 |
| 번들 크기 | 안 쓰는 기능은 결과물에서 빠져 다운로드할 파일이 작아짐 |

---

## 3. 우리 서비스 관점 — 뒤로가기 상태 유지, 선택지가 넓어진다

### 지금 (Nuxt 2): 화면을 통째로 보관

- `keep-alive`로 화면 전체를 메모리에 붙잡아 둔다.
- 캐시할 화면 목록을 레이아웃 한 곳에서 관리한다.
- 방문한 화면이 쌓일수록 무거워진다.
- 안 보이는 화면도 살아 있어서 **watch · 타이머 · 이벤트 리스너가 계속 동작**한다(예: `$route`를 watch하는
  캐시된 목록이 다른 페이지 이동 때도 실행됨).

```vue
<!-- layouts/default.vue -->
<Nuxt keep-alive :keep-alive-props="{ include: ['OrderList'] }" />
```

### Nuxt 3: 필요한 만큼만 보관

**① 페이지별 선택 (keep-alive)** — 각 페이지가 "나는 캐시해 줘"를 직접 선언한다. 레이아웃의 이름 목록을 맞출
필요가 없다. **선언 위치만 바뀐 같은 keep-alive**라서, 보관된 화면의 watch는 지금처럼 계속 돈다. 대신 보관 범위를
필요한 페이지로 줄일 수 있다.

```vue
<!-- pages/orders/index.vue -->
<script setup>
definePageMeta({ keepalive: true });
</script>
```

**② 데이터만 캐시 (keep-alive 아님)** — 화면은 버리고, 받아온 데이터(JSON)만 기억해 뒀다가 돌아오면 그걸로
바로 그린다. 떠날 때 화면이 정리되므로 **watch · 타이머 · 리스너도 같이 정리**된다.

1. **목록 진입** — 서버에서 받아 데이터를 이름표(key)와 함께 보관
2. **상세로 이동** — 목록 화면은 비움, 데이터는 남김
3. **뒤로가기** — 요청 없이 보관된 데이터로 바로 표시

**원리 — 어디에 보관되나**

- Nuxt 3에는 **기본 내장 보관함 `nuxtApp.payload.data`**가 있다. `useAsyncData("orders", …)`로 받은 결과는
  `payload.data["orders"]`처럼 이름표(key)별로 저장된다.
- 이 보관함은 원래 **서버에서 받은 데이터를 브라우저로 넘기는 통로**다. 첫 진입 때 서버가 받은 데이터를 HTML에
  담아 보내고(`__NUXT_DATA__`), 브라우저가 이걸 채워서 같은 요청을 두 번 하지 않는다.
- 페이지 이동은 새로고침 없이 화면만 바뀌므로(SPA), 이 보관함은 **탭이 열려 있는 동안 브라우저 메모리에 유지**된다.
  새로고침하거나 새 탭을 열면 비워진다(localStorage나 서버 저장이 아님).
- 기본 동작은 페이지 이동 시 다시 요청이다. `getCachedData` 옵션으로 "보관함에 있으면 그걸 써"라고 지정하면
  뒤로가기 때 요청 없이 바로 그린다.

| | Nuxt 2 | Nuxt 3 |
|---|---|---|
| 페이지 이동 후 데이터 | `asyncData`가 매번 다시 실행, 이름표 붙은 보관함 없음 | 같은 보관함에 key별로 유지 |
| 뒤로가기 즉시 표시 | Vuex에 직접 저장하는 코드를 짜거나 keep-alive로 화면째 보관 | `getCachedData` 옵션으로 가능 |

데이터 캐시는 **Nuxt 2에서도 직접 만들면 가능**하다(아래 예시). 다만 화면마다 이런 코드를 짜고 key 관리 · 유효 시간을
직접 만들어야 한다. Nuxt 3는 이게 **기본 내장**이라 옵션 하나로 된다. (Vue3 자체 기능이 아니라 Nuxt 3의 기능이다.)

```js
// Nuxt 2에서 직접 구현하는 예
async asyncData({ store }) {
  if (!store.state.orders.list.length) {   // 보관본이 없을 때만
    await store.dispatch("orders/fetch");  // 요청해서 Vuex에 저장
  }
},
computed: {
  orders() { return this.$store.state.orders.list; },
},
```

keep-alive는 화면 전체(요소 · 임시 상태)를 붙잡아 두지만, 데이터 캐시는 가벼운 데이터만 남겨서 메모리 부담이 적다.
데이터가 오래되지 않게 유효 시간을 두거나, 수정 · 삭제 후 `clearNuxtData("orders")`로 지우면 된다.

```vue
<script setup>
const nuxtApp = useNuxtApp();

const { data: orders } = await useAsyncData(
  "orders",                         // 이 키로 데이터를 캐시
  () => $fetch("/api/orders"),
  {
    // 이미 받아둔 데이터가 있으면 다시 요청하지 않고 그대로 사용
    getCachedData: (key) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);
</script>
```

필터나 페이지 번호는 URL 쿼리(`?page=3`)에, 스크롤 위치는 라우터의 스크롤 복원에 맡기면 된다.

| | 지금 (Nuxt 2 · keep-alive) | Nuxt 3 |
|---|---|---|
| 보관하는 것 | 화면 전체 | ① 필요한 페이지만 (keep-alive), 또는 ② 데이터만 |
| 안 보이는 화면의 watch · 타이머 | 계속 동작 | ① 선언한 페이지는 계속 동작 · ② 정리됨 |
| 캐시 설정 위치 | 레이아웃의 이름 목록 | 각 페이지에서 직접 선언 |
| 메모리 | 방문한 화면이 쌓일수록 증가 | 가볍게 유지 |
| 돌아왔을 때 | 바로 표시 | 바로 표시 (그대로) |

---

## 4. 어떻게 전환하나

### 전환할 때 손봐야 하는 것

| Nuxt 2 | Nuxt 3 | 메모 |
|---|---|---|
| `asyncData` · `fetch` | `useAsyncData` · `useFetch` | 데이터 조회 방식 |
| `store/` (Vuex) | Pinia · `useState` | 상태 관리 교체 |
| `@nuxtjs/axios` (`this.$axios`) | `$fetch` · `useFetch` | HTTP 클라이언트 |
| `head()` | `useHead` · `useSeoMeta` | 메타 태그 |
| `<Nuxt>` · `<NuxtChild>` | `<NuxtPage>` | 페이지 렌더 컴포넌트 |
| 필터 `{{ x \| won }}` · 이벤트 버스 `$on` | 함수 · 상태 관리 | Vue3에서 제거 |
| Nuxt 2 모듈 · 플러그인 | Nuxt 3 대응 버전 | 호환 여부 확인 필요 |

Nuxt 2 → 3는 Vue 문법 변화에 더해 Nuxt 자체 API도 바뀐다. **쓰고 있는 Nuxt 모듈이 Nuxt 3를 지원하는지**
먼저 목록을 뽑아 보는 게 좋다.

### 단계별 전환 — 한 번에 갈아엎지 않는다

1. **Nuxt Bridge** — Nuxt 2 프로젝트에서 Composition API와 Nuxt 3 스타일 API를 먼저 써볼 수 있는 공식
   중간 단계.
2. **문법 · 모듈 정리** — 필터, 이벤트 버스를 걷어내고, 모듈의 Nuxt 3 호환 여부를 확인한다.
3. **상태 · 데이터** — Vuex → Pinia, `asyncData` → `useAsyncData`로 옮긴다.
4. **Nuxt 3 전환** — Swiper 등 라이브러리를 최신 버전으로 교체한다.

기간과 담당 범위: **[팀에서 결정]**

---

## 대안 검토 — 그렇다면 React(Next.js)로 가면?

| 관점 | Nuxt 3 (Vue3) | React (Next.js) |
|---|---|---|
| 라이브러리 | Vue용은 선택지가 적은 편 | **가장 큰 생태계** — 캐러셀 · 제스처 등 선택지 풍부 |
| 인력 · 채용 | 상대적으로 작은 인력 풀 | **가장 큰 인력 풀** — 채용 · 외부 자료 풍부 |
| 전환 비용 | **문법 일부 유지**, 단계적 전환 가능 | 화면 전체 재작성 |
| 팀 학습 | **기존 Vue 경험 활용** | 새로 학습 필요 (JSX · Hooks) |

Nuxt 2 → 3도 데이터 조회 · 상태 관리 · 모듈을 다시 짜는 **대공사**다. 같은 공사라면, 생태계와 인력 풀이 큰
쪽이 장기적으로 유리할 수 있다. 최종 판단: **[팀에서 결정]**

---

## 정리

- **왜** — Vue2 · Nuxt 2 모두 지원이 끝났고, Swiper · 핀치줌처럼 라이브러리 선택이 이미 막혀 있다.
- **무엇이** — 코드 구조, 반응형, 성능, 타입 지원이 좋아진다.
- **어떻게** — Nuxt Bridge → 문법 · 모듈 정리 → 상태 · 데이터 → Nuxt 3, 단계적으로.
