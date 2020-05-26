package salt

import (
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewClientDefault(t *testing.T) {
	tests := map[string]struct {
		value    string
		expected string
	}{
		"default": {value: "", expected: "https://salt-master:4507"},
		"env_var": {value: "https://foo:4507", expected: "https://foo:4507"},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			os.Setenv("METALK8S_SALT_MASTER_ADDRESS", tc.value)

			client, _ := NewClient(nil, []byte("<insert_your_cert_here>"))

			assert.Equal(t, tc.expected, client.address)
		})
	}
}

func TestNewClientNoCaCert(t *testing.T) {
	_, err := NewClient(nil, []byte{})
	assert.Error(t, err)
	assert.Regexp(t, regexp.MustCompile("Empty CA cert"), err.Error())
}

func TestNewRequest(t *testing.T) {
	tests := map[string]struct {
		is_auth  bool
		expected string
	}{
		"no_auth":   {is_auth: false, expected: ""},
		"with_auth": {is_auth: true, expected: "foo"},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			client, _ := NewClient(nil, []byte("<insert_your_cert_here>"))
			client.token = newToken("foo", 0)

			request, _ := client.newRequest("POST", "/", nil, tc.is_auth)
			token := request.Header.Get("X-Auth-Token")

			assert.Equal(t, tc.expected, token)
		})
	}
}

func TestDecodeApiResponse(t *testing.T) {
	tests := map[string]struct {
		status int
		body   io.ReadCloser
		result map[string]interface{}
		error  string
	}{
		"httpError": {
			status: 401, body: httpBody("error"),
			result: nil, error: "Salt API failed with code 401: error",
		},
		"formatError": {
			status: 200, body: httpBody("<html></html>"),
			result: nil, error: "cannot decode Salt API response",
		},
		"ok": {
			status: 200, body: httpBody(`{"token": "foo"}`),
			result: map[string]interface{}{"token": "foo"}, error: "",
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			response := http.Response{StatusCode: tc.status, Body: tc.body}

			result, err := decodeApiResponse(&response)

			if tc.error != "" {
				assert.Error(t, err)
				assert.Regexp(t, regexp.MustCompile(tc.error), err.Error())
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tc.result, result)
			}
		})
	}
}

func TestExtractJID(t *testing.T) {
	tests := map[string]struct {
		ans map[string]interface{}
		jid string
	}{
		"ok": {
			ans: map[string]interface{}{"return": []interface{}{
				map[string]interface{}{"jid": "foobar"},
			}},
			jid: "foobar",
		},
		"empty": {
			ans: map[string]interface{}{},
			jid: "",
		},
		"missingReturn": {
			ans: map[string]interface{}{"jid": "foo"},
			jid: "",
		},
		"invalidReturn": {
			ans: map[string]interface{}{"return": "foo"},
			jid: "",
		},
		"noResult": {
			ans: map[string]interface{}{"return": []interface{}{}},
			jid: "",
		},
		"missingJID": {
			ans: map[string]interface{}{"return": []interface{}{
				map[string]interface{}{"id": "foo"},
			}},
			jid: "",
		},
		"invalidJID": {
			ans: map[string]interface{}{"return": []interface{}{
				map[string]interface{}{"jid": 42},
			}},
			jid: "",
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			jid, err := extractJID(tc.ans)

			if tc.jid != "" {
				assert.NoError(t, err)
				assert.Equal(t, tc.jid, jid)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

func TestExtractToken(t *testing.T) {
	tests := map[string]struct {
		ans map[string]interface{}
		tok *authToken
	}{
		"ok": {
			ans: map[string]interface{}{"return": []interface{}{
				map[string]interface{}{"token": "foobar", "expire": 3.14},
			}},
			tok: newToken("foobar", 3.14),
		},
		"empty": {
			ans: map[string]interface{}{},
			tok: nil,
		},
		"missingReturn": {
			ans: map[string]interface{}{"jid": "foo"},
			tok: nil,
		},
		"invalidReturn": {
			ans: map[string]interface{}{"return": "foo"},
			tok: nil,
		},
		"noResult": {
			ans: map[string]interface{}{"return": []interface{}{}},
			tok: nil,
		},
		"missingExpire": {
			ans: map[string]interface{}{"return": []interface{}{
				map[string]interface{}{"token": "foo"},
			}},
			tok: nil,
		},
		"invalidExpire": {
			ans: map[string]interface{}{"return": []interface{}{
				map[string]interface{}{"token": "foo", "expire": "bar"},
			}},
			tok: nil,
		},
		"missingToken": {
			ans: map[string]interface{}{"return": []interface{}{
				map[string]interface{}{"expire": 3.14},
			}},
			tok: nil,
		},
		"invalidToken": {
			ans: map[string]interface{}{"return": []interface{}{
				map[string]interface{}{"token": 42, "expire": "bar"},
			}},
			tok: nil,
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			token, err := extractToken(tc.ans)

			if tc.tok != nil {
				assert.NoError(t, err)
				assert.Equal(t, tc.tok, token)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

func httpBody(body string) io.ReadCloser {
	return ioutil.NopCloser(strings.NewReader(body))
}
