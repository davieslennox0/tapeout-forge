# FabX replay (BUILD.md 1c.5 - rebuilt from REAL fetched vectors, not guessed gate names)

Scope: the 46 tasks 1c.1 proved have a COMPLETE deterministic spec (comb, nIn<=8; see docs/VECTOR-SPEC-CHECK.md). The other 54 (8 wide-input combinational tasks with 9 to 18 inputs + all 46 sequential) are excluded - sampled vectors only, fitting them would be overfitting per BUILD.md's explicit rule. Convention: WITH 2*nOut buffer gates and +2 depth (resolved from Task 8's real Cref=1728 in Phase 1b/1c). Every "beat" below is independently re-derived and bit-compared against the real fetched vectors before being counted, not trusted from optimize()'s own internal check.

**Counts**: beat 22 / tie 11 / lose 13 / skip 0 (of 46 attempted). At the 4x q-cap: 1/46. Median q: 1.000.

## Top 10 margins (Cref/bestC, descending - biggest beats first)

| task | name | nIn/nOut | Cref | bestC | q | objective | verdict |
|---|---|---|---|---|---|---|---|
| 12 | GC-012 四到二独热编码与错误检测器 | 4/4 | 496000 | 28672 | 4.000 | area | beat |
| 46 | GC-046 八路低位优先编码器 | 8/4 | 367416 | 92000 | 3.994 | depth | beat |
| 45 | GC-045 八位字尾随零计数器 | 8/4 | 334084 | 93000 | 3.592 | depth | beat |
| 43 | GC-043 八位字置位计数器 | 8/4 | 2780346 | 889253 | 3.127 | area | beat |
| 44 | GC-044 八位字前导零计数器 | 8/4 | 334084 | 113135 | 2.953 | area | beat |
| 54 | GC-054 四位可变逻辑移位器 | 7/4 | 155987 | 53217 | 2.931 | area | beat |
| 55 | GC-055 四位可变循环移位器 | 7/4 | 186745 | 64152 | 2.911 | depth | beat |
| 39 | GC-039 三位无符号乘法器 | 6/6 | 576000 | 205632 | 2.801 | area | beat |
| 50 | GC-050 四位二进制转两位十进制BCD | 4/8 | 43000 | 15778 | 2.725 | area | beat |
| 37 | GC-037 四位补码绝对值转换器 | 4/4 | 63936 | 26244 | 2.436 | area | beat |

## Full results (all 46)

| task | name | nIn/nOut | Cref | bestC | q | objective | verdict |
|---|---|---|---|---|---|---|---|
| 1 | GC-001 单比特反相器 | 1/1 | 81 | 81 | 1.000 | area | tie |
| 2 | GC-002 双输入与非门 | 2/1 | 81 | 81 | 1.000 | area | tie |
| 3 | GC-003 双输入与门 | 2/1 | 256 | 256 | 1.000 | area | tie |
| 4 | GC-004 双输入或门 | 2/1 | 320 | 320 | 1.000 | area | tie |
| 5 | GC-005 双输入或非门 | 2/1 | 750 | 750 | 1.000 | area | tie |
| 6 | GC-006 双输入异或门 | 2/1 | 750 | 750 | 1.000 | area | tie |
| 7 | GC-007 双输入同或门 | 2/1 | 1512 | 875 | 1.728 | area | beat |
| 8 | GC-008 三输入多数表决器 | 3/1 | 1728 | 1728 | 1.000 | area | tie |
| 9 | GC-009 单比特二选一选择器 | 3/1 | 750 | 750 | 1.000 | area | tie |
| 10 | GC-010 单比特一分二分配器 | 2/2 | 1125 | 1125 | 1.000 | area | tie |
| 11 | GC-011 带使能的二到四译码器 | 3/4 | 8918 | 9604 | 0.929 | area | lose |
| 12 | GC-012 四到二独热编码与错误检测器 | 4/4 | 496000 | 28672 | 4.000 | area | beat |
| 13 | GC-013 四位相等比较器 | 8/1 | 48384 | 29000 | 1.668 | area | beat |
| 14 | GC-014 四位全零检测器 | 4/1 | 8748 | 4116 | 2.125 | area | beat |
| 15 | GC-015 四位偶校验位生成器 | 4/1 | 7168 | 7203 | 0.995 | depth | lose |
| 16 | GC-016 四位数据偶校验检查器 | 5/1 | 32832 | 26000 | 1.263 | depth | beat |
| 17 | GC-017 单比特半加器 | 2/2 | 1125 | 1250 | 0.900 | area | lose |
| 18 | GC-018 单比特全加器 | 3/2 | 6656 | 9216 | 0.722 | area | lose |
| 19 | GC-019 单比特半减器 | 2/2 | 1375 | 1375 | 1.000 | area | tie |
| 20 | GC-020 单比特全减器 | 3/2 | 8704 | 8704 | 1.000 | area | tie |
| 21 | GC-021 二位无符号大小比较器 | 4/3 | 16384 | 12348 | 1.327 | area | beat |
| 22 | GC-022 四位回绕加一器 | 4/4 | 16767 | 10290 | 1.629 | depth | beat |
| 23 | GC-023 四位回绕减一器 | 4/4 | 24000 | 18432 | 1.302 | depth | beat |
| 24 | GC-024 四位固定一位逻辑移位器 | 4/8 | 128 | 2048 | 0.250 | area | lose |
| 25 | GC-025 四位位序反转器 | 4/4 | 64 | 1024 | 0.250 | area | lose |
| 34 | GC-034 四位无符号饱和加法器 | 8/5 | 139944 | 226368 | 0.618 | area | lose |
| 35 | GC-035 四位无符号饱和减法器 | 8/5 | 417605 | 371293 | 1.125 | area | beat |
| 36 | GC-036 四位补码大小比较器 | 8/3 | 115776 | 81000 | 1.429 | depth | beat |
| 37 | GC-037 四位补码绝对值转换器 | 4/4 | 63936 | 26244 | 2.436 | area | beat |
| 38 | GC-038 四位补码饱和加法器 | 8/5 | 404681 | 839680 | 0.482 | area | lose |
| 39 | GC-039 三位无符号乘法器 | 6/6 | 576000 | 205632 | 2.801 | area | beat |
| 40 | GC-040 四位双输入最小最大值选择器 | 8/8 | 239625 | 222912 | 1.075 | area | beat |
| 43 | GC-043 八位字置位计数器 | 8/4 | 2780346 | 889253 | 3.127 | area | beat |
| 44 | GC-044 八位字前导零计数器 | 8/4 | 334084 | 113135 | 2.953 | area | beat |
| 45 | GC-045 八位字尾随零计数器 | 8/4 | 334084 | 93000 | 3.592 | depth | beat |
| 46 | GC-046 八路低位优先编码器 | 8/4 | 367416 | 92000 | 3.994 | depth | beat |
| 47 | GC-047 带使能的三到八译码器 | 4/8 | 43011 | 26068 | 1.650 | area | beat |
| 48 | GC-048 四位二进制转格雷码转换器 | 4/4 | 2500 | 2875 | 0.870 | area | lose |
| 49 | GC-049 四位格雷码转二进制转换器 | 4/4 | 14336 | 22016 | 0.651 | depth | lose |
| 50 | GC-050 四位二进制转两位十进制BCD | 4/8 | 43000 | 15778 | 2.725 | area | beat |
| 51 | GC-051 两位BCD转七位二进制转换器 | 8/8 | 713336 | 759375 | 0.939 | area | lose |
| 53 | GC-053 带使能的四位一分四分配器 | 7/16 | 59778 | 49392 | 1.210 | area | beat |
| 54 | GC-054 四位可变逻辑移位器 | 7/4 | 155987 | 53217 | 2.931 | area | beat |
| 55 | GC-055 四位可变循环移位器 | 7/4 | 186745 | 64152 | 2.911 | depth | beat |
| 87 | GC-087 汉明(7,4)单错纠正译码器 | 7/15 | 823080 | 1967448 | 0.418 | depth | lose |
| 88 | GC-088 汉明(8,4)SECDED译码器 | 8/17 | 3863552 | 4257360 | 0.907 | area | lose |

## Task 8 (GC-008, 3-input majority) explicitly
refNand=8, refDepth=6, Cref=1728. Our best: C=1728 via objective=area -> **tie**.
