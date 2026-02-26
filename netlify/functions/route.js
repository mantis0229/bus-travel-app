exports.handler = async (event) => {
  const { origin, destination } = JSON.parse(event.body);
  
  const REST_API_KEY = "786a0d72bee0975417b6cddb2c8a812b";
  
  // 카카오 로컬 API로 정류장 좌표 검색
  const searchCoord = async (name) => {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(name + " 광주 버스정류장")}&size=1`,
      { headers: { Authorization: `KakaoAK ${REST_API_KEY}` } }
    );
    const data = await res.json();
    if (data.documents && data.documents.length > 0) {
      return { x: data.documents[0].x, y: data.documents[0].y };
    }
    return null;
  };

  try {
    const [originCoord, destCoord] = await Promise.all([
      searchCoord(origin),
      searchCoord(destination)
    ]);

    if (!originCoord || !destCoord) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "좌표를 찾을 수 없어요" })
      };
    }

    // 카카오 모빌리티 경로 API
    const routeRes = await fetch(
      `https://apis-navi.kakaomobility.com/v1/directions?origin=${originCoord.x},${originCoord.y}&destination=${destCoord.x},${destCoord.y}&priority=RECOMMEND`,
      { headers: { Authorization: `KakaoAK ${REST_API_KEY}` } }
    );
    const routeData = await routeRes.json();

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ routeData, originCoord, destCoord })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};