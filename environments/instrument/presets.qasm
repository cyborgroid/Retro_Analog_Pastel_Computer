// ===== bell: 벨 상태 |Φ+⟩
// 00과 11만 반씩 나옵니다. 두 큐비트가 얽혀 있습니다.
OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
creg c[2];
h q[0];
cx q[0],q[1];
measure q[0] -> c[0];
measure q[1] -> c[1];

// ===== ghz: GHZ 5큐비트
// 00000과 11111만 나옵니다. 결합 맵(T자형)을 따라 CNOT을 배치했습니다.
OPENQASM 2.0;
include "qelib1.inc";
qreg q[5];
creg c[5];
h q[0];
cx q[0],q[1];
cx q[1],q[2];
cx q[1],q[3];
cx q[3],q[4];
measure q[0] -> c[0];
measure q[1] -> c[1];
measure q[2] -> c[2];
measure q[3] -> c[3];
measure q[4] -> c[4];

// ===== superpos: 균등 중첩 3큐비트
// 8가지 결과가 고르게 나옵니다(각 12.5 %).
OPENQASM 2.0;
include "qelib1.inc";
qreg q[3];
creg c[3];
h q[0];
h q[1];
h q[2];
measure q[0] -> c[0];
measure q[1] -> c[1];
measure q[2] -> c[2];

// ===== grover: 그로버 검색 (|11⟩ 찾기)
// 한 번의 반복으로 표시된 답 11이 거의 100 % 나옵니다.
OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
creg c[2];
h q[0];
h q[1];
cz q[0],q[1];
h q[0];
h q[1];
x q[0];
x q[1];
cz q[0],q[1];
x q[0];
x q[1];
h q[0];
h q[1];
measure q[0] -> c[0];
measure q[1] -> c[1];

// ===== bv: 번스타인–바지라니 (비밀 101)
// 한 번의 질의로 비밀 문자열 101을 알아냅니다. Q2–Q3는 비인접이라 SWAP 라우팅이 붙습니다.
OPENQASM 2.0;
include "qelib1.inc";
qreg q[4];
creg c[4];
x q[3];
h q[0];
h q[1];
h q[2];
h q[3];
cx q[0],q[3];
cx q[2],q[3];
h q[0];
h q[1];
h q[2];
measure q[0] -> c[0];
measure q[1] -> c[1];
measure q[2] -> c[2];

// ===== dj: 도이치–조사 (균형 함수)
// 결과가 00이 아니면 함수는 균형입니다. 여기서는 11이 나옵니다.
OPENQASM 2.0;
include "qelib1.inc";
qreg q[3];
creg c[3];
x q[2];
h q[0];
h q[1];
h q[2];
cx q[0],q[2];
cx q[1],q[2];
h q[0];
h q[1];
measure q[0] -> c[0];
measure q[1] -> c[1];

// ===== teleport: 양자 순간이동 (지연 측정)
// Q0에 만든 상태 RY(1.2)가 Q2로 옮겨집니다. Q2에서 1이 나올 확률은 sin²(0.6) ≈ 31.9 %입니다.
OPENQASM 2.0;
include "qelib1.inc";
qreg q[3];
creg c[3];
ry(1.200000) q[0];
h q[1];
cx q[1],q[2];
cx q[0],q[1];
h q[0];
cx q[1],q[2];
cz q[0],q[2];
measure q[2] -> c[2];

// ===== qft3: QFT 3큐비트 (|101⟩ 입력)
// 확률은 고르지만 상태벡터의 위상이 계단처럼 돕니다. 상태벡터 표의 위상 원판을 보세요.
OPENQASM 2.0;
include "qelib1.inc";
qreg q[3];
creg c[3];
x q[0];
x q[2];
h q[2];
cu1(1.570796) q[1],q[2];
cu1(0.785398) q[0],q[2];
h q[1];
cu1(1.570796) q[0],q[1];
h q[0];
swap q[0],q[2];

// ===== bloch: 블로흐 구 데모
// 측정 없이 각 큐비트의 방향만 봅니다. Q0은 −Y, Q1은 X–Z 사이, Q2는 +Y를 향합니다.
OPENQASM 2.0;
include "qelib1.inc";
qreg q[3];
creg c[3];
rx(1.570796) q[0];
ry(0.785398) q[1];
h q[2];
s q[2];
